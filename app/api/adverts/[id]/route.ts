import { correctionAudit, advertPricingAudit } from "@/lib/correction-audit";
import { validateProductImages } from "@/lib/server-image";
import { withAuthorization } from "@/lib/route-authorization";
import { readPower, reviewPower } from "@/lib/power-inclusion";
import { NextResponse } from "next/server";
import { advertSchema } from "@/lib/advert";
import { prisma } from "@/lib/prisma";
import { selectProductImage } from "@/lib/product-image";
import { canEditAdvert, canUseOriginalImage } from "@/lib/user-role";
import { ensureCurrentUser } from "@/lib/server-user";

async function GETHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser(); const id = (await params).id;
  const advert = await prisma.advertisement.findUnique({ where: { id }, include: { createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, auditLogs: { orderBy: { createdAt: "asc" } } } });
  if (!advert) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
  if (user.role === "STAFF" && advert.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(advert);
}

async function PUTHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser(); const id = (await params).id;
  const current = await prisma.advertisement.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
  if (!canEditAdvert(current, user)) return NextResponse.json({ error: "This advert is locked for editing" }, { status: 403 });
  const parsed = advertSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Advert validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (parsed.data.useOriginalImage && !canUseOriginalImage(user.role)) return NextResponse.json({ error: "Only Marketing or Admin users may use the original product image" }, { status: 403 });
  await validateProductImages(parsed.data, true);
  const { productId, ...input } = parsed.data;
  if(input.pricingMethod==="PDF" && input.sellingPrice!==current.sellingPrice) input.pricingMethod="MANUAL";
  const beforePower=readPower(current.powerInclusionJson);
  input.powerInclusionJson=JSON.stringify(reviewPower(beforePower,readPower(input.powerInclusionJson),user.id));
  const sourcePage = await prisma.pdfImportPage.findFirst({where:{advertisementId:id},select:{id:true,pdfImportId:true,pageNumber:true,extractedPricingJson:true}});
  const updated = await prisma.$transaction(async (tx) => {
    const advert = await tx.advertisement.update({ where: { id, updatedAt:current.updatedAt, status:current.status }, data: { ...input, productId: productId || null, productImage: selectProductImage(parsed.data), sellingPrice: Math.round(input.sellingPrice), lastEditedByUserId: user.id } });
    await tx.auditLog.create({ data: { action: "UPDATE_DRAFT", entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: current.status, newStatus: advert.status, metadata: JSON.stringify({...correctionAudit(current,advert,{userId:user.id,advertisementId:id,sourcePage,priceOverride:current.sellingPrice!==advert.sellingPrice||current.pricingMethod!==advert.pricingMethod,finalConfirmation:true}),pricingBefore:advertPricingAudit(current),pricingAfter:advertPricingAudit(advert),powerBefore:beforePower,powerAfter:readPower(input.powerInclusionJson),imageHistory:current.originalImageUrl!==advert.originalImageUrl||current.processedImageUrl!==advert.processedImageUrl?{before:{source:current.originalImageUrl,processed:current.processedImageUrl},after:{source:advert.originalImageUrl,processed:advert.processedImageUrl}}:undefined}) } }); return advert;
  });
  return NextResponse.json(updated);
}

export const GET = withAuthorization("READ", GETHandler);

export const PUT = withAuthorization("CREATE", PUTHandler);
