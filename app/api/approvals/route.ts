import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";
import { canReviewAdvert } from "@/lib/user-role";

async function GETHandler(request: Request) {
  const user = await ensureCurrentUser(); if (!canReviewAdvert(user.role) && user.role !== "MARKETING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status") || "AWAITING_APPROVAL";
  const adverts = await prisma.advertisement.findMany({ where: status === "ALL" ? undefined : { status }, include: { createdBy: { select: { name: true } }, submittedBy: { select: { name: true } } }, orderBy: { submittedAt: "desc" } });
  return NextResponse.json(adverts);
}

export const GET = withAuthorization("MARKETING", GETHandler);
