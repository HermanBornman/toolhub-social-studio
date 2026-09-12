import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server"; import { ensureCurrentUser } from "@/lib/server-user";
async function GETHandler(){return NextResponse.json(await ensureCurrentUser());}

export const GET = withAuthorization("READ", GETHandler);
