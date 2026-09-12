import { validatePng } from "@/lib/png-transparency";
import { validateProductImages } from "@/lib/server-image";
import { artworkType } from "@/lib/final-artwork";
import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { advertSchema } from "@/lib/advert";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { assertCanSubmit } from "@/lib/workflow";

async function POSTHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensureCurrentUser(); const id = (await params).id;
    const advert = await prisma.advertisement.findUnique({ where: { id } });
    if (!advert) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
    const action = assertCanSubmit(advert, user);
    const validation = advertSchema.safeParse({ ...advert, sellingPrice: advert.sellingPrice, processedImageUrl: advert.processedImageUrl || "", secondarySpecification: advert.secondarySpecification || "", feature01: advert.feature01 || "", feature02: advert.feature02 || "", keyBenefit: advert.keyBenefit || "", productId: advert.productId || undefined });
    if (!validation.success) return NextResponse.json({ error: "Advert is not ready for approval", issues: validation.error.flatten().fieldErrors }, { status: 400 });
    await validateProductImages(validation.data,true);
    const body = await request.json();
    if(body.expectedUpdatedAt!==advert.updatedAt.toISOString()) throw new Error("CONCURRENT_EDIT");
    if(typeof body.artworkDataUrl!=="string") throw new Error("FINAL_ARTWORK_MISSING");
    validatePng(body.artworkDataUrl,{finalArtwork:true});
    if([advert.productImage,advert.processedImageUrl,advert.originalImageUrl].includes(body.artworkDataUrl)) throw new Error("FINAL_ARTWORK_MISSING");
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.advertisement.update({ where: { id, updatedAt:advert.updatedAt, status:advert.status }, data: { status: "AWAITING_APPROVAL", submittedAt: new Date(), submittedByUserId: user.id, approvalComment: null } });
      const asset=await tx.advertisementAsset.create({data:{advertisementId:id,type:artworkType("SUBMITTED",result),path:body.artworkDataUrl,mimeType:"image/png"}});
      await tx.auditLog.create({ data: { action, entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: advert.status, newStatus: "AWAITING_APPROVAL",metadata:JSON.stringify({artworkAssetId:asset.id,snapshotType:asset.type}) } }); return result;
    });
    return NextResponse.json({ id, status: updated.status });
  } catch (error) { const result = errorResponse(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}

export const POST = withAuthorization("CREATE", POSTHandler);
