import { NextResponse } from "next/server";
import { advertSchema, TEMPLATE_VERSION } from "@/lib/advert";
import { prisma } from "@/lib/prisma";
import { selectProductImage } from "@/lib/product-image";
import { canUseOriginalImage } from "@/lib/user-role";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = advertSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Advert validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });

    const input = parsed.data;
    if (input.useOriginalImage && !canUseOriginalImage()) {
      return NextResponse.json({ error: "Only Marketing or Admin users may use the original product image" }, { status: 403 });
    }
    const mood = await prisma.mascotMood.findUnique({ where: { id: input.moodId } });
    if (!mood?.active) return NextResponse.json({ error: "The selected mascot mood is not approved" }, { status: 400 });
    const template = await prisma.template.findUnique({ where: { version: TEMPLATE_VERSION } });

    const advert = await prisma.$transaction(async (tx) => {
      const created = await tx.advertisement.create({
        data: {
          ...input,
          productImage: selectProductImage(input),
          sellingPrice: Math.round(input.sellingPrice),
          templateVersion: TEMPLATE_VERSION,
          status: "DRAFT",
          templateId: template?.id,
        },
      });
      await tx.auditLog.create({ data: { action: "CREATE_DRAFT", entityType: "Advertisement", entityId: created.id, advertisementId: created.id, metadata: JSON.stringify({ templateVersion: TEMPLATE_VERSION }) } });
      return created;
    });

    return NextResponse.json({ id: advert.id, status: advert.status, templateVersion: advert.templateVersion }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to save the draft" }, { status: 500 });
  }
}
