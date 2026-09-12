import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthorization } from "@/lib/route-authorization";
import { safeUserSelect } from "@/lib/auth/users";

export const GET = withAuthorization("ADMIN", async (request: Request) => {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 100) || "";
  const users = await prisma.user.findMany({ where: { OR: [{ email: { contains: q } }, { name: { contains: q } }] }, select: safeUserSelect, orderBy: { name: "asc" }, take: 100 });
  return NextResponse.json(users);
});
