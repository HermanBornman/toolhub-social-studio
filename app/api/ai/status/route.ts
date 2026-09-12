import { withAuthorization } from "@/lib/route-authorization";
import{NextResponse}from"next/server";import{aiMode,getAIClient}from"@/lib/ai/ai-service";import{ensureCurrentUser,errorResponse}from"@/lib/server-user";
async function GETHandler(){return NextResponse.json({mode:aiMode(),provider:process.env.AI_PROVIDER||"openai",modelConfigured:Boolean(process.env.AI_MODEL),keyConfigured:Boolean(process.env.OPENAI_API_KEY),model:process.env.AI_MODEL||"Not configured"})}
async function POSTHandler(){try{const user=await ensureCurrentUser();if(user.role!=="ADMIN")throw new Error("FORBIDDEN");return NextResponse.json(await getAIClient().testConnection())}catch(error){const out=errorResponse(error);return NextResponse.json({error:out.error},{status:out.status})}}

export const GET = withAuthorization("MARKETING", GETHandler);

export const POST = withAuthorization("ADMIN", POSTHandler);
