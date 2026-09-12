import { NextResponse } from "next/server";
import { analyzePdfPage } from "@/lib/pdf-analysis";
import { pageAnalysisRequestSchema } from "@/lib/pdf-import";
import { extractedPricing } from "@/lib/import-pricing";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; pageNumber: string }> }) {
  const user = await ensureCurrentUser();
  const { id, pageNumber: pageParam } = await params;
  const pageNumber = Number(pageParam);
  const parsed = pageAnalysisRequestSchema.safeParse(await request.json());
  if (!parsed.success || !Number.isInteger(pageNumber) || pageNumber < 1) return NextResponse.json({ error: "Page analysis input is invalid" }, { status: 400 });
  const page = await prisma.pdfImportPage.findUnique({ where: { pdfImportId_pageNumber: { pdfImportId: id, pageNumber } }, include: { pdfImport: true } });
  if (!page) return NextResponse.json({ error: "PDF page not found" }, { status: 404 });
  if (user.role === "STAFF" && page.pdfImport.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if(page.advertisementId)return NextResponse.json({error:"This page already has a draft"},{status:409});
  await prisma.pdfImportPage.update({ where: { id: page.id }, data: { status: "ANALYZING", rawExtractedText: parsed.data.embeddedText, pagePreviewDataUrl: parsed.data.pagePreviewDataUrl } });
  const result = await analyzePdfPage({ pageNumber, ...parsed.data });
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.pdfImportPage.update({ where: { id: page.id }, data: { status: "REVIEW_REQUIRED", rawExtractedText: parsed.data.embeddedText, ocrText: result.ocrText, pagePreviewDataUrl: parsed.data.pagePreviewDataUrl, extractedPricingJson: page.extractedPricingJson === "{}" ? JSON.stringify(extractedPricing(result.analysis)) : page.extractedPricingJson, analysisJson: JSON.stringify(result.analysis) } });
    await tx.auditLog.create({ data: { action: "PDF_PAGE_ANALYSIS", entityType: "PdfImportPage", entityId: page.id, userId: user.id, userName: user.name, previousStatus: page.status, newStatus: "REVIEW_REQUIRED", metadata: JSON.stringify({ pdfImportId: id, pageNumber, powerInclusion: result.analysis.powerInclusion, method: result.method, fallbackError: result.error }) } });
    await tx.aIUsage.create({ data: { action: "PDF_PAGE_ANALYSIS", entityType: "PdfImportPage", entityId: page.id, provider: result.method === "AI_VISION" ? "openai" : "heuristic", model: result.method === "AI_VISION" ? (process.env.AI_MODEL || "gpt-5-mini") : "deterministic-v1", promptVersion: "pdf-analysis-v1", success: result.method === "AI_VISION", inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, userId: user.id, metadata: JSON.stringify({ pageNumber, error: result.error }) } });
    return saved;
  });
  return NextResponse.json({ ...updated, analysis: result.analysis, analysisMethod: result.method });
}
