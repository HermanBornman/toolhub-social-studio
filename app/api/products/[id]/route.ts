import { validateProductImages } from "@/lib/server-image";
import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/product";
import { canManageProducts } from "@/lib/user-role";
import { ensureCurrentUser } from "@/lib/server-user";

async function GETHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const product = await prisma.product.findUnique({ where: { id: (await params).id } });
  return product ? NextResponse.json(product) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

async function PUTHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser(); const id = (await params).id;
  if (!canManageProducts(user.role)) return NextResponse.json({ error: "You do not have permission to edit products" }, { status: 403 });
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Product validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  await validateProductImages(parsed.data, false);
  const duplicate = await prisma.product.findFirst({ where: { sku: parsed.data.sku, NOT: { id } } });
  if (duplicate) return NextResponse.json({ error: "A product with this SKU already exists", existing: { id: duplicate.id } }, { status: 409 });
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const imageChanged = before.originalImageUrl !== parsed.data.originalImageUrl;
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: { ...parsed.data, normalPrice: parsed.data.normalPrice || null, processedImageUrl: parsed.data.processedImageUrl || null, updatedByUserId: user.id } });
    await tx.auditLog.create({ data: { action: imageChanged ? "PRODUCT_IMAGE_REPLACE" : "PRODUCT_UPDATE", entityType: "Product", entityId: id, userId: user.id, userName: user.name, metadata: JSON.stringify({ sku: updated.sku }) } }); return updated;
  });
  return NextResponse.json(product);
}

export const GET = withAuthorization("READ", GETHandler);

export const PUT = withAuthorization("CREATE", PUTHandler);
