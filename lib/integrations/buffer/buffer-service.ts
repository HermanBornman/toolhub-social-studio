import { BufferGraphQLClient,gqlString } from "./buffer-client"; import { BufferError } from "./buffer-errors"; import type { BufferAccount,BufferChannel,BufferCreateInput,BufferPostResult,BufferService } from "./buffer-types";

export class LiveBufferService implements BufferService {
  readonly dryRun=false; constructor(private client=new BufferGraphQLClient()){}
  async getBufferAccount(){const data=await this.client.request<{account:BufferAccount}>(`query { account { id name email organizations { id name } } }`);return data.account;}
  async getOrganizations(){return (await this.getBufferAccount()).organizations;}
  async getChannels(organizationId:string){const data=await this.client.request<{channels:BufferChannel[]}>(`query { channels(input:{organizationId:${gqlString(organizationId)}}) { id name displayName service isDisconnected isLocked organizationId } }`);return data.channels;}
  async createPost(input:BufferCreateInput){const due=input.dueAt?` dueAt:${gqlString(input.dueAt)}`:"",metadata=input.service==="facebook"?" metadata:{facebook:{type:post}}":input.service==="instagram"?" metadata:{instagram:{type:post shouldShareToFeed:true}}":"";const data=await this.client.request<{createPost:{post?:BufferPostResult;message?:string}}>(`mutation { createPost(input:{text:${gqlString(input.text)} channelId:${gqlString(input.channelId)} schedulingType:automatic mode:${input.mode}${due}${metadata} assets:[{image:{url:${gqlString(input.imageUrl)}}}]}) { ... on PostActionSuccess { post { id status dueAt } } ... on MutationError { message } } }`);if(!data.createPost.post)throw new BufferError(data.createPost.message||"Buffer rejected the post","MUTATION_ERROR",data.createPost);return data.createPost.post;}
  async getPosts(organizationId:string,channelIds:string[]){const ids=channelIds.map(gqlString).join(",");const data=await this.client.request<{posts:{edges:Array<{node:BufferPostResult}>}}>(`query { posts(first:100 input:{organizationId:${gqlString(organizationId)} filter:{channelIds:[${ids}]}}) { edges { node { id status dueAt } } } }`);return data.posts.edges.map(edge=>edge.node);}
  async deleteScheduledPost(postId:string){const data=await this.client.request<{deletePost:{id?:string;message?:string}}>(`mutation { deletePost(input:{id:${gqlString(postId)}}) { ... on DeletePostSuccess { id } ... on MutationError { message } } }`);if(!data.deletePost.id)throw new BufferError(data.deletePost.message||"Buffer could not delete the post","MUTATION_ERROR");}
}

export class DryRunBufferService implements BufferService {
  readonly dryRun=true;
  async getBufferAccount(){return {id:"dry-account",name:"Toolhub Dry Run",email:"dry-run@toolhub.local",organizations:[{id:"dry-toolhub-org",name:"Toolhub (Dry Run)"}]};}
  async getOrganizations(){return (await this.getBufferAccount()).organizations;}
  async getChannels(organizationId:string){return [{id:"dry-facebook-toolhub",name:"toolhub",displayName:"Facebook — Toolhub",service:"facebook",isDisconnected:false,isLocked:false,organizationId},{id:"dry-instagram-toolhub",name:"toolhub",displayName:"Instagram — Toolhub",service:"instagram",isDisconnected:false,isLocked:false,organizationId}];}
  async createPost(input:BufferCreateInput){if(process.env.SOCIAL_DRY_RUN_FAIL_SERVICE&&input.channelId.includes(process.env.SOCIAL_DRY_RUN_FAIL_SERVICE))throw new BufferError("Simulated dry-run channel failure","DRY_RUN_FAILURE");const source=`${input.channelId}|${input.mode}|${input.dueAt||"now"}|${input.text}|${input.imageUrl}`,hash=[...source].reduce((value,char)=>Math.imul(value^char.charCodeAt(0),16777619)>>>0,2166136261).toString(36);return {id:`dry_${hash}`,status:input.mode==="shareNow"?"sent":"scheduled",dueAt:input.dueAt||new Date().toISOString()};}
  async getPosts(){return [];}
  async deleteScheduledPost(){return;}
}

export function getPublishingMode(){return process.env.SOCIAL_PUBLISHING_MODE==="live"?"live":"dry-run";}
export function getBufferService():BufferService{return getPublishingMode()==="live"?new LiveBufferService():new DryRunBufferService();}
