import { getFinalArtwork } from "@/lib/final-artwork-service";
import { artworkType } from "@/lib/final-artwork";
import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { approvalActionSchema, assertCanReview } from "@/lib/workflow";

async function POSTHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensureCurrentUser(); const id = (await params).id;
    const body=await request.json();
    const parsed = approvalActionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Approval action validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    const advert = await prisma.advertisement.findUnique({ where: { id } });
    if (!advert) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
    const nextStatus = assertCanReview(advert, parsed.data.action, user); const now = new Date();
    const submitted = nextStatus==="APPROVED" ? await getFinalArtwork(advert,"SUBMITTED") : null;
    if(submitted && body.artworkAssetId!==submitted.id) throw new Error("ARTWORK_REQUIRES_REVIEW");
    const statusFields = nextStatus === "APPROVED" ? { approvedAt: now, approvedByUserId: user.id } : nextStatus === "REJECTED" ? { rejectedAt: now, rejectedByUserId: user.id } : {};
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.advertisement.update({ where: { id, updatedAt:advert.updatedAt, status:"AWAITING_APPROVAL" }, data: { status: nextStatus, approvalComment: parsed.data.comment || null, ...statusFields } });
      const approvedAsset=submitted ? await tx.advertisementAsset.create({data:{advertisementId:id,type:artworkType("APPROVED",result),path:submitted.path,mimeType:"image/png"}}) : null;
      await tx.auditLog.create({ data: { action: parsed.data.action, entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: advert.status, newStatus: nextStatus, metadata: JSON.stringify({ comment: parsed.data.comment, submittedArtworkId:submitted?.id,approvedArtworkId:approvedAsset?.id,snapshotType:approvedAsset?.type }) } }); return result;
    });
    return NextResponse.json({ id, status: updated.status });
  } catch (error) { const result = errorResponse(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}

export const POST = withAuthorization("REVIEW", POSTHandler);
