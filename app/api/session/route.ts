import { NextResponse } from "next/server"; import { ensureCurrentUser } from "@/lib/server-user";
export async function GET(){return NextResponse.json(await ensureCurrentUser());}
