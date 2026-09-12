import { withAuthorization } from "@/lib/route-authorization";
import{NextResponse}from"next/server";import{prisma}from"@/lib/prisma";import{ensureCurrentUser,errorResponse}from"@/lib/server-user";import{generateWeeklyPlan}from"@/lib/plan-service";
async function GETHandler(){return NextResponse.json(await prisma.contentPlan.findMany({include:{createdBy:true,items:{include:{advertisement:true,channel:true}}},orderBy:{weekStart:"desc"}}))}async function POSTHandler(request:Request){try{const user=await ensureCurrentUser(),body=await request.json();return NextResponse.json(await generateWeeklyPlan({weekStart:String(body.weekStart),channelIds:Array.isArray(body.channelIds)?body.channelIds:[]},user),{status:201})}catch(error){const out=errorResponse(error);return NextResponse.json({error:error instanceof Error?error.message:out.error},{status:out.status})}}

export const GET = withAuthorization("MARKETING", GETHandler);

export const POST = withAuthorization("MARKETING", POSTHandler);
