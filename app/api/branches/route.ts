import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";
import { withAuthorization } from "@/lib/route-authorization";

async function GETHandler() {
  const user = await ensureCurrentUser();
  const rows = await prisma.branch.findMany({
    where: { active: true, ...(user.role === "ADMIN" ? {} : { users: { some: { id: user.id } } }) },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rows);
}

export const GET = withAuthorization("READ", GETHandler);
