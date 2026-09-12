import { correctionAudit } from "@/lib/correction-audit";
import { validateProductImages } from "@/lib/server-image";
import { withAuthorization } from "@/lib/route-authorization";
import { emptyPower, readPower, reviewPower } from "@/lib/power-inclusion";
import { NextResponse } from "next/server";
import { advertSchema, TEMPLATE_VERSION } from "@/lib/advert";
import { prisma } from "@/lib/prisma";
import { selectProductImage } from "@/lib/product-image";
import { canCreateAdvert, canUseOriginalImage } from "@/lib/user-role";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";

async function GETHandler() {
  const user = await ensureCurrentUser();
  const adverts = await prisma.advertisement.findMany({
    where: user.role === "STAFF" ? { createdByUserId: user.id } : undefined,
    include: { createdBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 30,
  });
  return NextResponse.json(adverts);
}

async function POSTHandler(request: Request) {
  try {
    const user = await ensureCurrentUser();
    if (!canCreateAdvert(user.role)) return NextResponse.json({ error: "You do not have permission to create adverts" }, { status: 403 });
    const parsed = advertSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Advert validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    await validateProductImages(parsed.data, true);
    const input = parsed.data;
    input.powerInclusionJson=JSON.stringify(reviewPower(emptyPower(),readPower(input.powerInclusionJson),user.id));
    if (input.useOriginalImage && !canUseOriginalImage(user.role)) return NextResponse.json({ error: "Only Marketing or Admin users may use the original product image" }, { status: 403 });
    const mood = await prisma.mascotMood.findUnique({ where: { id: input.moodId } });
    if (!mood?.active) return NextResponse.json({ error: "The selected mascot mood is not approved" }, { status: 400 });
    const template = await prisma.template.findUnique({ where: { version: TEMPLATE_VERSION } });
    const { productId, ...snapshot } = input;
    const advert = await prisma.$transaction(async (tx) => {
      const created = await tx.advertisement.create({ data: {
        ...snapshot, productId: productId || null, productImage: selectProductImage(input), sellingPrice: Math.round(input.sellingPrice),
        templateVersion: TEMPLATE_VERSION, status: "DRAFT", templateId: template?.id, createdByUserId: user.id, lastEditedByUserId: user.id,
      } });
      await tx.auditLog.create({ data: { action: "CREATE_DRAFT", entityType: "Advertisement", entityId: created.id, advertisementId: created.id, userId: user.id, userName: user.name, newStatus: "DRAFT", metadata: JSON.stringify({ ...correctionAudit(null,created,{userId:user.id,advertisementId:created.id}), templateVersion: TEMPLATE_VERSION, productId, powerInclusion:readPower(input.powerInclusionJson) }) } });
      return created;
    });
    return NextResponse.json({ id: advert.id, status: advert.status, templateVersion: advert.templateVersion, updatedAt:advert.updatedAt }, { status: 201 });
  } catch (error) {
    const result = errorResponse(error); return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export const GET = withAuthorization("READ", GETHandler);

export const POST = withAuthorization("CREATE", POSTHandler);
