import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";import { prisma } from "@/lib/prisma";import { ensureCurrentUser,errorResponse } from "@/lib/server-user";import { getBufferService } from "@/lib/integrations/buffer/buffer-service";import { syncSocialChannels } from "@/lib/social-service";
async function GETHandler(){const channels=await prisma.socialChannel.findMany({orderBy:[{service:"asc"},{name:"asc"}]});const organization=await prisma.applicationSetting.findUnique({where:{key:"BUFFER_ORGANIZATION_ID"}});return NextResponse.json({channels,organizationId:organization?.value||null,mode:getBufferService().dryRun?"dry-run":"live",configured:Boolean(process.env.BUFFER_API_KEY)});}
async function POSTHandler(request:Request){try{const user=await ensureCurrentUser();const {action}=await request.json();if(user.role!=="ADMIN")throw new Error("FORBIDDEN");if(action==="test"){const service=getBufferService();const account=await service.getBufferAccount();return NextResponse.json({message:"Buffer connection successful",account,dryRun:service.dryRun});}if(action==="sync")return NextResponse.json(await syncSocialChannels(user));throw new Error("UNKNOWN_ACTION");}catch(error){const result=errorResponse(error);return NextResponse.json({error:error instanceof Error?error.message:result.error},{status:result.status});}}
async function PATCHHandler(request:Request){const user=await ensureCurrentUser();if(user.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});const {id,publishingEnabled}=await request.json();const channel=await prisma.socialChannel.update({where:{id},data:{publishingEnabled:Boolean(publishingEnabled)}});return NextResponse.json(channel);}

export const GET = withAuthorization("MARKETING", GETHandler);

export const POST = withAuthorization("ADMIN", POSTHandler);

export const PATCH = withAuthorization("ADMIN", PATCHHandler);
