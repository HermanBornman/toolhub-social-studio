import { NextResponse } from "next/server";
import { advertSchema } from "@/lib/advert";
import { prisma } from "@/lib/prisma";
import { selectProductImage } from "@/lib/product-image";
import { canEditAdvert, canUseOriginalImage } from "@/lib/user-role";
import { ensureCurrentUser } from "@/lib/server-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser(); const id = (await params).id;
  const advert = await prisma.advertisement.findUnique({ where: { id }, include: { createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, auditLogs: { orderBy: { createdAt: "asc" } } } });
  if (!advert) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
  if (user.role === "STAFF" && advert.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(advert);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser(); const id = (await params).id;
  const current = await prisma.advertisement.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
  if (!canEditAdvert(current, user)) return NextResponse.json({ error: "This advert is locked for editing" }, { status: 403 });
  const parsed = advertSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Advert validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (parsed.data.useOriginalImage && !canUseOriginalImage(user.role)) return NextResponse.json({ error: "Only Marketing or Admin users may use the original product image" }, { status: 403 });
  const { productId, ...input } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    const advert = await tx.advertisement.update({ where: { id }, data: { ...input, productId: productId || null, productImage: selectProductImage(parsed.data), sellingPrice: Math.round(input.sellingPrice), lastEditedByUserId: user.id } });
    await tx.auditLog.create({ data: { action: "UPDATE_DRAFT", entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: current.status, newStatus: advert.status } }); return advert;
  });
  return NextResponse.json(updated);
}
