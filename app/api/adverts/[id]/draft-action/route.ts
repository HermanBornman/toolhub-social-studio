import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { withAuthorization } from "@/lib/route-authorization";
import { authBody } from "@/lib/auth/http";

const schema = z.object({ action: z.enum(["DUPLICATE", "ARCHIVE"]) });

async function POSTHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensureCurrentUser();
    const id = (await params).id;
    const parsed = schema.safeParse(await authBody(request));
    if (!parsed.success) throw new Error("INVALID_USER_INPUT");
    const current = await prisma.advertisement.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Advert not found" }, { status: 404 });
    if (user.role !== "ADMIN" && current.createdByUserId !== user.id) throw new Error("FORBIDDEN");

    if (parsed.data.action === "ARCHIVE") {
      if (current.status !== "DRAFT") throw new Error("INVALID_TRANSITION");
      await prisma.$transaction(async tx => {
        const changed = await tx.advertisement.updateMany({ where: { id, status: "DRAFT", updatedAt: current.updatedAt }, data: { status: "ARCHIVED", archivedAt: new Date() } });
        if (changed.count !== 1) throw new Error("CONCURRENT_EDIT");
        await tx.auditLog.create({ data: { action: "ARCHIVE_DRAFT", entityType: "Advertisement", entityId: id, advertisementId: id, userId: user.id, userName: user.name, previousStatus: "DRAFT", newStatus: "ARCHIVED" } });
      });
      return NextResponse.json({ id, status: "ARCHIVED" });
    }

    const {
      id: _id, createdAt: _created, updatedAt: _updated,
      submittedAt: _submitted, submittedByUserId: _submitter,
      approvedAt: _approved, approvedByUserId: _approver,
      rejectedAt: _rejected, rejectedByUserId: _rejector,
      approvalComment: _comment, finalizedAt: _finalized,
      finalizedByUserId: _finalizer, finalArtworkData: _art,
      finalArtworkMimeType: _mime, finalArtworkWidth: _width,
      finalArtworkHeight: _height, finalVersion: _version,
      archivedAt: _archived, ...snapshot
    } = current;
    const duplicate = await prisma.$transaction(async tx => {
      const created = await tx.advertisement.create({ data: { ...snapshot, status: "DRAFT", createdByUserId: user.id, lastEditedByUserId: user.id } });
      await tx.auditLog.create({ data: { action: "DUPLICATE_DRAFT", entityType: "Advertisement", entityId: created.id, advertisementId: created.id, userId: user.id, userName: user.name, newStatus: "DRAFT", metadata: JSON.stringify({ sourceAdvertisementId: id }) } });
      return created;
    });
    return NextResponse.json({ id: duplicate.id, status: duplicate.status });
  } catch (error) {
    const out = errorResponse(error);
    return NextResponse.json({ error: out.error }, { status: out.status });
  }
}

export const POST = withAuthorization("CREATE", POSTHandler);
