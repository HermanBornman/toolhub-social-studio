import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/product";
import { canManageProducts } from "@/lib/user-role";
import { ensureCurrentUser } from "@/lib/server-user";

export async function GET(request: Request) {
  const url = new URL(request.url); const query = url.searchParams.get("q")?.trim() || ""; const includeInactive = url.searchParams.get("includeInactive") === "true";
  const products = await prisma.product.findMany({ where: {
    active: includeInactive ? undefined : true,
    OR: query ? ["sku", "productName", "barcode", "brand", "category"].map((field) => ({ [field]: { contains: query } })) : undefined,
  }, orderBy: [{ active: "desc" }, { productName: "asc" }] });
  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const user = await ensureCurrentUser();
  if (!canManageProducts(user.role)) return NextResponse.json({ error: "You do not have permission to create products" }, { status: 403 });
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Product validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
  if (existing) return NextResponse.json({ error: "A product with this SKU already exists", existing: { id: existing.id, sku: existing.sku, productName: existing.productName } }, { status: 409 });
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...parsed.data, normalPrice: parsed.data.normalPrice || null, processedImageUrl: parsed.data.processedImageUrl || null, createdByUserId: user.id, updatedByUserId: user.id } });
    await tx.auditLog.create({ data: { action: "PRODUCT_CREATE", entityType: "Product", entityId: created.id, userId: user.id, userName: user.name, metadata: JSON.stringify({ sku: created.sku }) } }); return created;
  });
  return NextResponse.json(product, { status: 201 });
}
