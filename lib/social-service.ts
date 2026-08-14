import { prisma } from "./prisma";
import type { CurrentUser } from "./user-role";
import { getBufferService } from "./integrations/buffer/buffer-service";
import { getMediaStorage } from "./media-storage";
import { aggregatePostStatus, johannesburgLocalToUtc } from "./social-publishing";
import { BufferError } from "./integrations/buffer/buffer-errors";

export async function syncSocialChannels(user: CurrentUser) {
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  const buffer=getBufferService(), account=await buffer.getBufferAccount();
  let organizationId=process.env.BUFFER_ORGANIZATION_ID || await prisma.applicationSetting.findUnique({where:{key:"BUFFER_ORGANIZATION_ID"}}).then(x=>x?.value) || account.organizations[0]?.id;
  if(!organizationId) throw new BufferError("No Buffer organization found", "ORGANIZATION_NOT_FOUND");
  const organization=account.organizations.find(item=>item.id===organizationId);
  if(!organization) throw new BufferError("Configured Buffer organization was not found", "ORGANIZATION_NOT_FOUND");
  await prisma.applicationSetting.upsert({where:{key:"BUFFER_ORGANIZATION_ID"},update:{value:organizationId,updatedBy:user.id},create:{key:"BUFFER_ORGANIZATION_ID",value:organizationId,updatedBy:user.id}});
  const channels=await buffer.getChannels(organizationId), now=new Date();
  for(const channel of channels) await prisma.socialChannel.upsert({where:{providerChannelId:channel.id},update:{organizationId,service:channel.service,name:channel.name,displayName:channel.displayName,connectedStatus:channel.isDisconnected||channel.isLocked?"ERROR":"CONNECTED",active:!channel.isDisconnected&&!channel.isLocked,lastSyncedAt:now,metadata:JSON.stringify(channel)},create:{providerChannelId:channel.id,organizationId,service:channel.service,name:channel.name,displayName:channel.displayName,connectedStatus:channel.isDisconnected||channel.isLocked?"ERROR":"CONNECTED",active:!channel.isDisconnected&&!channel.isLocked,publishingEnabled:!channel.isDisconnected&&!channel.isLocked,lastSyncedAt:now,metadata:JSON.stringify(channel)}});
  await prisma.auditLog.create({data:{action:"SOCIAL_CHANNEL_SYNC",entityType:"SocialChannel",entityId:organizationId,userId:user.id,userName:user.name,metadata:JSON.stringify({organization:organization.name,channelCount:channels.length,dryRun:buffer.dryRun})}});
  return {account,organization,channels,dryRun:buffer.dryRun};
}

export async function processSocialPost(socialPostId:string, action:"SOCIAL_POST_SCHEDULE"|"SOCIAL_POST_PUBLISH_NOW"|"SOCIAL_POST_RETRY", user:CurrentUser, simulateInstagramFailure=false,platformCaptions?:Record<string,string>) {
  const buffer=getBufferService();
  const post=await prisma.socialPost.findUnique({where:{id:socialPostId},include:{channels:{include:{socialChannel:true}}}});
  if(!post) throw new Error("NOT_FOUND");
  const targets=(action==="SOCIAL_POST_RETRY"?post.channels.filter(x=>x.status==="FAILED"):post.channels.filter(x=>!x.providerPostId));
  for(const target of targets) {
    if(target.providerPostId||["PUBLISHED","SCHEDULED","DRY_RUN_COMPLETE"].includes(target.status)) continue;
    const attemptNumber=target.attemptCount+1;
    const attempt=await prisma.publishingAttempt.create({data:{socialPostId:post.id,socialPostChannelId:target.id,channelId:target.socialChannelId,attemptNumber,action}});
    try {
      if(!target.socialChannel.active||!target.socialChannel.publishingEnabled||target.socialChannel.connectedStatus!=="CONNECTED") throw new BufferError("Channel is disabled or disconnected","CHANNEL_UNAVAILABLE");
      if(simulateInstagramFailure&&target.socialChannel.service==="instagram") throw new BufferError("Simulated Instagram failure","DRY_RUN_FAILURE");
      const result=await buffer.createPost({channelId:target.socialChannel.providerChannelId,service:target.socialChannel.service,text:platformCaptions?.[target.socialChannel.service]||post.caption,imageUrl:post.finalArtworkUrl,mode:post.mode==="NOW"?"shareNow":"customScheduled",dueAt:post.scheduledAt?.toISOString()});
      const status=buffer.dryRun&&post.mode==="NOW"?"DRY_RUN_COMPLETE":post.mode==="NOW"?"PUBLISHED":"SCHEDULED";
      await prisma.$transaction([prisma.socialPostChannel.update({where:{id:target.id},data:{status,providerPostId:result.id,providerStatus:result.status,providerDueAt:result.dueAt?new Date(result.dueAt):post.scheduledAt,providerResponse:JSON.stringify({...result,dryRun:buffer.dryRun}),errorCode:null,errorMessage:null,attemptCount:attemptNumber}}),prisma.publishingAttempt.update({where:{id:attempt.id},data:{completedAt:new Date(),success:true,providerPostId:result.id,responseMetadata:JSON.stringify({...result,dryRun:buffer.dryRun})}})]);
    } catch(error) {
      const code=error instanceof BufferError?error.code:"UNKNOWN", message=error instanceof Error?error.message:"Publishing failed";
      await prisma.$transaction([prisma.socialPostChannel.update({where:{id:target.id},data:{status:"FAILED",errorCode:code,errorMessage:message,attemptCount:attemptNumber}}),prisma.publishingAttempt.update({where:{id:attempt.id},data:{completedAt:new Date(),success:false,errorCode:code,errorMessage:message}})]);
    }
  }
  const refreshed=await prisma.socialPost.findUniqueOrThrow({where:{id:post.id},include:{channels:true}});
  let overall=aggregatePostStatus(refreshed.channels.map(x=>x.status));
  if(buffer.dryRun&&post.mode==="NOW"&&refreshed.channels.every(x=>x.status==="DRY_RUN_COMPLETE")) overall="READY";
  await prisma.socialPost.update({where:{id:post.id},data:{status:overall,publishedAt:overall==="PUBLISHED"?new Date():undefined}});
  await prisma.auditLog.create({data:{action,entityType:"SocialPost",entityId:post.id,advertisementId:post.advertisementId,socialPostId:post.id,userId:user.id,userName:user.name,newStatus:overall,metadata:JSON.stringify({dryRun:buffer.dryRun,channelCount:targets.length})}});
  return prisma.socialPost.findUniqueOrThrow({where:{id:post.id},include:{channels:{include:{socialChannel:true}},attempts:true}});
}

export async function createSocialPost(input:{idempotencyKey:string;advertisementId:string;caption:string;platformCaptions?:Record<string,string>;channelIds:string[];mode:"SCHEDULE"|"NOW";scheduledLocal?:string;timezone:string;artworkDataUrl:string;simulateInstagramFailure?:boolean}, user:CurrentUser) {
  const existing=await prisma.socialPost.findUnique({where:{idempotencyKey:input.idempotencyKey},include:{channels:{include:{socialChannel:true}},attempts:true}}); if(existing)return existing;
  if(input.mode==="NOW"&&!['MANAGER','ADMIN'].includes(user.role))throw new Error("FORBIDDEN"); if(input.mode==="SCHEDULE"&&!['MARKETING','MANAGER','ADMIN'].includes(user.role))throw new Error("FORBIDDEN");
  const advert=await prisma.advertisement.findUnique({where:{id:input.advertisementId}}); if(!advert)throw new Error("NOT_FOUND"); if(advert.status!=="APPROVED")throw new Error("ADVERT_NOT_APPROVED");
  const channels=await prisma.socialChannel.findMany({where:{id:{in:input.channelIds},active:true,publishingEnabled:true,connectedStatus:"CONNECTED"}}); if(channels.length!==input.channelIds.length)throw new Error("CHANNEL_UNAVAILABLE");
  const scheduledAt=input.mode==="SCHEDULE"?johannesburgLocalToUtc(input.scheduledLocal||""):null; if(scheduledAt&&scheduledAt<=new Date())throw new Error("SCHEDULE_IN_PAST");
  const buffer=getBufferService();
  const post=await prisma.socialPost.create({data:{idempotencyKey:input.idempotencyKey,advertisementId:advert.id,caption:input.caption,status:"PUBLISHING",mode:input.mode,scheduledAt,timezone:input.timezone,finalArtworkUrl:"pending",finalArtworkData:input.artworkDataUrl,dryRun:buffer.dryRun,createdByUserId:user.id,channels:{create:channels.map(channel=>({socialChannelId:channel.id,status:"READY",intendedSchedule:scheduledAt}))}}});
  const stored=await getMediaStorage().upload(`adverts/${advert.id}/social-posts/${post.id}.png`,input.artworkDataUrl), finalArtworkUrl=stored.provider==="DATABASE"?`/api/social-posts/${post.id}/artwork`:stored.url;
  await prisma.socialPost.update({where:{id:post.id},data:{finalArtworkUrl,finalArtworkData:stored.provider==="DATABASE"?stored.data:null}});
  await prisma.auditLog.create({data:{action:"SOCIAL_POST_CREATE",entityType:"SocialPost",entityId:post.id,advertisementId:advert.id,socialPostId:post.id,userId:user.id,userName:user.name,newStatus:"PUBLISHING",metadata:JSON.stringify({mode:input.mode,storage:stored.provider,dryRun:buffer.dryRun})}});
  return processSocialPost(post.id,input.mode==="NOW"?"SOCIAL_POST_PUBLISH_NOW":"SOCIAL_POST_SCHEDULE",user,input.simulateInstagramFailure,input.platformCaptions);
}
