import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { pdfImportSchema } from "@/lib/pdf-import";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";

async function GETHandler() {
  const user = await ensureCurrentUser();
  const imports = await prisma.pdfImport.findMany({
    where: user.role === "STAFF" ? { createdByUserId: user.id } : undefined,
    include: { pages: { orderBy: { pageNumber: "asc" }, select: { id: true, pageNumber: true, status: true, advertisementId: true } } },
    orderBy: { updatedAt: "desc" }, take: 30,
  });
  return NextResponse.json(imports);
}

async function POSTHandler(request: Request) {
  const user = await ensureCurrentUser();
  const parsed = pdfImportSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "PDF metadata is invalid", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    const pdfImport = await tx.pdfImport.create({
      data: {
        filename: input.filename, mimeType: input.mimeType, fileSize: input.size, pageCount: input.pageCount, createdByUserId: user.id,
        pages: { create: Array.from({ length: input.pageCount }, (_, index) => ({ pageNumber: index + 1 })) },
      }, include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
    await tx.auditLog.create({ data: { action: "PDF_IMPORT", entityType: "PdfImport", entityId: pdfImport.id, userId: user.id, userName: user.name, newStatus: "IMPORTED", metadata: JSON.stringify({ filename: input.filename, pageCount: input.pageCount, fileSize: input.size, defaultRule: "ONE_ADVERT_PER_PAGE" }) } });
    return pdfImport;
  });
  return NextResponse.json(created, { status: 201 });
}

export const GET = withAuthorization("READ", GETHandler);

export const POST = withAuthorization("CREATE", POSTHandler);
