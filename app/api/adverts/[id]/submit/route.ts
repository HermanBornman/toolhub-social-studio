import { NextResponse } from "next/server";
import { advertSchema } from "@/lib/advert";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { assertCanSubmit } from "@/lib/workflow";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensureCurrentUser(); const id = (await params).id;
    const advert = await prisma.advertisement.findUnique({ where: { id } });
    if (!advert) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
    const action = assertCanSubmit(advert, user);
    const validation = advertSchema.safeParse({ ...advert, sellingPrice: advert.sellingPrice, processedImageUrl: advert.processedImageUrl || "", secondarySpecification: advert.secondarySpecification || "", feature01: advert.feature01 || "", feature02: advert.feature02 || "", keyBenefit: advert.keyBenefit || "", productId: advert.productId || undefined });
    if (!validation.success) return NextResponse.json({ error: "Advert is not ready for approval", issues: validation.error.flatten().fieldErrors }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.advertisement.update({ where: { id }, data: { status: "AWAITING_APPROVAL", submittedAt: new Date(), submittedByUserId: user.id, approvalComment: null } });
      await tx.auditLog.create({ data: { action, entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: advert.status, newStatus: "AWAITING_APPROVAL" } }); return result;
    });
    return NextResponse.json({ id, status: updated.status });
  } catch (error) { const result = errorResponse(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
