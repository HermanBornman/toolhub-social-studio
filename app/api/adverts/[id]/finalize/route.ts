import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { canFinalizeAdvert, STORE_MANAGER_BRANCH_REQUIRED } from "@/lib/user-role";
import { pngDimensions } from "@/lib/png";
import { advertSchema } from "@/lib/advert";
import { withAuthorization } from "@/lib/route-authorization";

const schema = z.object({ artworkDataUrl: z.string().startsWith("data:image/png;base64,").max(20_000_000) });

async function POSTHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensureCurrentUser();
    const id = (await params).id;
    const current = await prisma.advertisement.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
    if (user.role === "STORE_MANAGER" && !user.branchId) return NextResponse.json({ error: STORE_MANAGER_BRANCH_REQUIRED }, { status: 409 });
    if (!canFinalizeAdvert(current, user)) throw new Error("FORBIDDEN");

    const facts = advertSchema.safeParse({
      ...current,
      productId: current.productId || undefined,
      processedImageUrl: current.processedImageUrl || "",
      secondarySpecification: current.secondarySpecification || "",
      feature01: current.feature01 || "",
      feature02: current.feature02 || "",
      keyBenefit: current.keyBenefit || "",
      sellingPrice: current.sellingPrice,
    });
    if (!facts.success) return NextResponse.json({ error: "Advert facts are incomplete; return to review before finalizing" }, { status: 409 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Final artwork validation failed" }, { status: 400 });
    if ([current.originalImageUrl, current.processedImageUrl, current.productImage].includes(parsed.data.artworkDataUrl)) {
      return NextResponse.json({ error: "Final artwork must be the composed advert, not a product source image" }, { status: 400 });
    }
    const image = pngDimensions(parsed.data.artworkDataUrl);
    if (image.width !== 1080 || image.height !== 1350) {
      return NextResponse.json({ error: `Final artwork must be 1080 × 1350; received ${image.width} × ${image.height}` }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.advertisement.updateMany({
        where: { id, status: current.status, updatedAt: current.updatedAt },
        data: {
          status: "FINALIZED",
          finalizedAt: now,
          finalizedByUserId: user.id,
          finalArtworkData: parsed.data.artworkDataUrl,
          finalArtworkMimeType: "image/png",
          finalArtworkWidth: image.width,
          finalArtworkHeight: image.height,
          finalVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new Error("CONCURRENT_EDIT");
      const advert = await tx.advertisement.findUniqueOrThrow({ where: { id } });
      await tx.advertisementAsset.create({ data: { advertisementId: id, type: "FINAL_ARTWORK", path: `/api/adverts/${id}/artwork`, mimeType: "image/png" } });
      await tx.auditLog.create({ data: { action: "FINALIZE", entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: current.status, newStatus: "FINALIZED", metadata: JSON.stringify({ width: image.width, height: image.height, mimeType: "image/png", version: advert.finalVersion }) } });
      return advert;
    });
    return NextResponse.json({ id, status: updated.status, finalizedAt: updated.finalizedAt, width: updated.finalArtworkWidth, height: updated.finalArtworkHeight, version: updated.finalVersion });
  } catch (error) {
    const out = errorResponse(error);
    return NextResponse.json({ error: out.error }, { status: out.status });
  }
}

export const POST = withAuthorization("CREATE", POSTHandler);
