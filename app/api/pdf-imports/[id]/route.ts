import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser();
  const { id } = await params;
  const pdfImport = await prisma.pdfImport.findUnique({ where: { id }, include: { pages: { orderBy: { pageNumber: "asc" } } } });
  if (!pdfImport) return NextResponse.json({ error: "PDF import not found" }, { status: 404 });
  if (user.role === "STAFF" && pdfImport.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(pdfImport);
}
