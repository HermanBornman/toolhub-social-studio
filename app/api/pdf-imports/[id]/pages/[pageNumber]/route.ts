import { correctionAudit } from "@/lib/correction-audit";
import { validateProductImages } from "@/lib/server-image";
import { withAuthorization } from "@/lib/route-authorization";
import { hasTransparentPng } from "@/lib/png-transparency";
import { emptyPower, reviewPower } from "@/lib/power-inclusion";
import { NextResponse } from "next/server";
import { z } from "zod";
import { advertSchema, TEMPLATE_VERSION } from "@/lib/advert";
import { calculateToolhubPrice, coreReviewIssues, MULTI_PRODUCT_DECISIONS, parseMoney, pdfPageAnalysisSchema } from "@/lib/pdf-import";
import { defaultPricing, extractedPricing, pricingInputSchema, resolvePricing } from "@/lib/import-pricing";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), analysis: pdfPageAnalysisSchema, pricing: pricingInputSchema.optional(), selectedImageDataUrl: z.string().max(12_000_000), processedImageDataUrl: z.string().max(12_000_000), backgroundRemovalStatus: z.enum(["PENDING", "PROCESSING", "COMPLETE", "FAILED"]), multiProductDecision: z.enum(MULTI_PRODUCT_DECISIONS).nullable().optional() }),
  z.object({ action: z.literal("approve"), analysis: pdfPageAnalysisSchema, pricing: pricingInputSchema.optional(), selectedImageDataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/), processedImageDataUrl: z.string().regex(/^data:image\/png;base64,/), multiProductDecision: z.enum(MULTI_PRODUCT_DECISIONS).nullable().optional() }),
  z.object({ action: z.literal("createDraft") }),
]);

async function POSTHandler(request: Request, { params }: { params: Promise<{ id: string; pageNumber: string }> }) {
  const user = await ensureCurrentUser();
  const { id, pageNumber: pageParam } = await params;
  const pageNumber = Number(pageParam);
  const input = requestSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Review data is invalid", issues: input.error.flatten().fieldErrors }, { status: 400 });
  const page = await prisma.pdfImportPage.findUnique({ where: { pdfImportId_pageNumber: { pdfImportId: id, pageNumber } }, include: { pdfImport: true } });
  if (!page) return NextResponse.json({ error: "PDF page not found" }, { status: 404 });
  if (user.role === "STAFF" && page.pdfImport.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (input.data.action === "save" || input.data.action === "approve") {
    if (page.advertisementId) return NextResponse.json({ error: "This page already has an advert; edit that draft instead" }, { status: 409 });
    const source = page.extractedPricingJson !== "{}" ? JSON.parse(page.extractedPricingJson) : extractedPricing(pdfPageAnalysisSchema.parse(JSON.parse(page.analysisJson)));
    const pricing = input.data.pricing ?? (page.pricingJson !== "{}" ? pricingInputSchema.parse(JSON.parse(page.pricingJson)) : defaultPricing(source));
    const pricingTrace = resolvePricing(source, pricing);
    const confirmedBy = pricingTrace.finalSellingPrice !== null ? user.id : null;
    const previousPower = JSON.parse(page.analysisJson).powerInclusion ?? emptyPower();
    const powerInclusion = reviewPower(previousPower,input.data.analysis.powerInclusion,user.id);
    const analysis = { ...input.data.analysis, wasPrice:source.wasPrice, powerInclusion, nettPrice: source.nettPrice, promotionalPrice: source.sellingPrice };
    const selectedImageDataUrl = input.data.selectedImageDataUrl;
    const processedImageDataUrl = input.data.processedImageDataUrl;
    const decision = input.data.multiProductDecision || null;
    await validateProductImages({originalImageUrl:selectedImageDataUrl,processedImageUrl:processedImageDataUrl,backgroundRemovalStatus:input.data.action === "approve" ? "COMPLETE" : input.data.backgroundRemovalStatus},input.data.action === "approve");

    if (input.data.action === "approve") {
      const issues = coreReviewIssues(analysis, { selectedImageReady: hasTransparentPng(processedImageDataUrl), multiProductDecision: decision, pricingValid: true });
      issues.push(...pricingTrace.errors);
      if (!analysis.technicalSpecifications.length) issues.push("Confirm at least one technical specification.");
      if (issues.length) return NextResponse.json({ error: "Confirmation required", issues }, { status: 409 });
    }
    const status = input.data.action === "approve" ? "REVIEW_APPROVED" : "REVIEW_REQUIRED";
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.pdfImportPage.update({ where: { id: page.id, updatedAt:page.updatedAt }, data: { status, analysisJson: JSON.stringify(analysis), selectedImageDataUrl, processedImageDataUrl, backgroundRemovalStatus: processedImageDataUrl ? "COMPLETE" : input.data.action === "save" ? input.data.backgroundRemovalStatus : "COMPLETE", multiProductDecision: decision, userCorrectionsJson: JSON.stringify({ savedAt: new Date().toISOString(), fields: analysis }), extractedPricingJson: JSON.stringify(source), pricingJson: JSON.stringify(pricing), priceConfirmedByUserId: confirmedBy, priceConfirmedAt: confirmedBy ? new Date() : null, pricingTraceJson: JSON.stringify({ ...pricingTrace, confirmedByUserId: confirmedBy }), reviewApprovedAt: input.data.action === "approve" ? new Date() : null, reviewApprovedByUserId: input.data.action === "approve" ? user.id : null } });
      await tx.auditLog.create({ data: { action: input.data.action === "approve" ? "PDF_REVIEW_APPROVE" : "PDF_REVIEW_CORRECTION", entityType: "PdfImportPage", entityId: page.id, userId: user.id, userName: user.name, previousStatus: page.status, newStatus: status, metadata: JSON.stringify({ ...correctionAudit({analysis:JSON.parse(page.analysisJson),pricing:JSON.parse(page.pricingJson),trace:JSON.parse(page.pricingTraceJson),selectedImageDataUrl:page.selectedImageDataUrl,processedImageDataUrl:page.processedImageDataUrl},{analysis,pricing,trace:pricingTrace,selectedImageDataUrl,processedImageDataUrl},{pdfImportId:id,pageId:page.id,pageNumber,advertisementId:page.advertisementId,userId:user.id,extractedPricing:source,finalConfirmation:input.data.action==="approve"}), powerBefore:previousPower,powerAfter:powerInclusion,pricingBefore:JSON.parse(page.pricingTraceJson),pricingAfter:pricingTrace,confirmedByUserId:confirmedBy, imageHistory: page.selectedImageDataUrl!==selectedImageDataUrl || page.processedImageDataUrl!==processedImageDataUrl ? {before:{source:page.selectedImageDataUrl,processed:page.processedImageDataUrl},after:{source:selectedImageDataUrl,processed:processedImageDataUrl}} : undefined }) } });
      return saved;
    });
    return NextResponse.json(updated);
  }

  if (page.advertisementId) return NextResponse.json({ id: page.advertisementId, status: "DRAFT", duplicate: true });
  if (page.status !== "REVIEW_APPROVED" || !page.reviewApprovedAt) return NextResponse.json({ error: "Approve the extracted information before creating an advert" }, { status: 409 });
  if(page.backgroundRemovalStatus!=="COMPLETE" || !hasTransparentPng(page.processedImageDataUrl))return NextResponse.json({error:"A reviewed transparent product PNG is required"},{status:409});
  const analysis = pdfPageAnalysisSchema.parse(JSON.parse(page.analysisJson));
  const source = JSON.parse(page.extractedPricingJson);
  const pricing = pricingInputSchema.parse(JSON.parse(page.pricingJson));
  const resolved = resolvePricing(source, pricing);
  if (resolved.errors.length || !page.priceConfirmedByUserId) return NextResponse.json({ error: "Confirm pricing before creating an advert", issues: resolved.errors }, { status: 409 });
  const sellingPrice = resolved.finalSellingPrice;
  const advertInput = {
    productName: analysis.productName.value, sku: analysis.sku.value,
    primarySpecification: analysis.technicalSpecifications[0]?.value || "", secondarySpecification: analysis.technicalSpecifications.slice(1, 3).map((item) => item.value).join(" · "),
    feature01: analysis.technicalSpecifications[3]?.value || "", feature02: analysis.technicalSpecifications[4]?.value || "", keyBenefit: "",
    pricingMethod: pricing.method, wasPrice: pricing.method === "SALE" ? Math.round(resolved.wasPrice!) : null,
    campaignType: "Standard Product" as const, campaignMessage: "BUILT FOR THE JOB", sellingPrice: String(sellingPrice || ""),
    powerInclusionJson: JSON.stringify(analysis.powerInclusion ?? emptyPower()),
    disclaimer: "WHILE STOCKS LAST", moodId: "thumbs_up" as const,
    originalImageUrl: page.selectedImageDataUrl, processedImageUrl: page.processedImageDataUrl, backgroundRemovalStatus: "COMPLETE" as const,
    useOriginalImage: false, qrUrl: "https://www.toolhub.co.za",
  };
  const validated = advertSchema.safeParse(advertInput);
  if (!validated.success) return NextResponse.json({ error: "Approved data is not yet sufficient for the advert template", issues: validated.error.flatten().fieldErrors }, { status: 409 });
  const template = await prisma.template.findUnique({ where: { version: TEMPLATE_VERSION } });
  const advert = await prisma.$transaction(async (tx) => {
    const claimed=await tx.pdfImportPage.updateMany({where:{id:page.id,advertisementId:null,status:"REVIEW_APPROVED"},data:{status:"DRAFT_CREATING"}});
    if(claimed.count!==1)throw new Error("Page draft creation already in progress");
    const created = await tx.advertisement.create({ data: { ...validated.data, pricingAuditJson: JSON.stringify({ ...resolved, confirmedByUserId: page.priceConfirmedByUserId, confirmedAt: page.priceConfirmedAt }), productId: null, productImage: page.processedImageDataUrl, sellingPrice: Math.round(validated.data.sellingPrice), templateVersion: TEMPLATE_VERSION, templateId: template?.id, status: "DRAFT", createdByUserId: user.id, lastEditedByUserId: user.id } });
    await tx.pdfImportPage.update({ where: { id: page.id }, data: { status: "DRAFT_CREATED", advertisementId: created.id } });
    await tx.auditLog.create({ data: { action: "PDF_DRAFT_CREATE", entityType: "Advertisement", entityId: created.id, advertisementId: created.id, userId: user.id, userName: user.name, newStatus: "DRAFT", metadata: JSON.stringify({ pdfImportId: id, pageNumber, sourcePageId: page.id, pricingTrace: JSON.parse(page.pricingTraceJson), extractedPricing: source, confirmedAnalysis: analysis, advertSnapshot: correctionAudit(null,created) }) } });
    return created;
  });
  return NextResponse.json({ id: advert.id, status: advert.status }, { status: 201 });
}

export const POST = withAuthorization("CREATE", POSTHandler);
