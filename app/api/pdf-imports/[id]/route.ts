import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";

async function GETHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser();
  const { id } = await params;
  const pdfImport = await prisma.pdfImport.findUnique({ where: { id }, include: { pages: { orderBy: { pageNumber: "asc" } } } });
  if (!pdfImport) return NextResponse.json({ error: "PDF import not found" }, { status: 404 });
  if (user.role === "STAFF" && pdfImport.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(pdfImport);
}

export const GET = withAuthorization("READ", GETHandler);
