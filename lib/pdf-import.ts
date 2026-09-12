import { z } from "zod";
import { detectPowerInclusion, powerInclusionSchema, type PowerInclusion } from "./power-inclusion";

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type SourceRegion = { x: number; y: number; width: number; height: number };
export type ExtractedField = {
  value: string;
  confidence: Confidence;
  source: "EMBEDDED_TEXT" | "OCR" | "VISUAL" | "USER" | "NOT_FOUND";
  sourcePage: number;
  boundingBox?: SourceRegion;
};

export type PdfPageAnalysis = {
  powerInclusion?: PowerInclusion;
  skuNotFoundAcknowledged?: boolean;
  wasPrice?: ExtractedField;
  detectedProducts?: Array<{name:string;sourceText:string}>;
  brand: ExtractedField;
  productName: ExtractedField;
  category: ExtractedField;
  model: ExtractedField;
  sku: ExtractedField;
  technicalSpecifications: ExtractedField[];
  includedItems: ExtractedField[];
  excludedItems: ExtractedField[];
  warranty: ExtractedField;
  nettPrice: ExtractedField;
  promotionalPrice: ExtractedField;
  warnings: ExtractedField[];
  productCount: number;
  mainProductBoundingBox?: SourceRegion;
  excludedBadgeRegions?: SourceRegion[];
  visualSummary: {
    mainProduct: string;
    accessories: string[];
    packaging: string[];
    compatibilityOnly: string[];
    decorative: string[];
  };
  analysisWarnings: string[];
};

const fieldSchema = z.object({
  value: z.string(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  source: z.enum(["EMBEDDED_TEXT", "OCR", "VISUAL", "USER", "NOT_FOUND"]),
  sourcePage: z.number().int().positive(),
  boundingBox: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).optional(),
});

export function excludeSupplierBadges(analysis: PdfPageAnalysis): PdfPageAnalysis {
  const clean = (value: string) => value.replace(/\bP\s*20\s*S\b(?:\s+platform)?|\bBL[\s-]*MOTOR\b/gi, "").replace(/\s+/g, " ").replace(/^[\s,;:/|–—-]+|[\s,;:/|–—-]+$/g, "").trim();
  const field = (item: ExtractedField): ExtractedField => {
    const value = clean(item.value);
    return value ? { ...item, value } : { value: "Not found", confidence: "LOW", source: "NOT_FOUND", sourcePage: item.sourcePage };
  };
  return { ...analysis, productName: field(analysis.productName), model: field(analysis.model),
    technicalSpecifications: analysis.technicalSpecifications.map(item => ({ ...item, value: clean(item.value) })).filter(item => item.value),
  };
}

export const pdfPageAnalysisSchema = z.object({
  powerInclusion: powerInclusionSchema.optional(),
  skuNotFoundAcknowledged: z.boolean().optional(),
  wasPrice: fieldSchema.optional(),
  detectedProducts: z.array(z.object({name:z.string(),sourceText:z.string()})).optional(),
  brand: fieldSchema,
  productName: fieldSchema,
  category: fieldSchema,
  model: fieldSchema,
  sku: fieldSchema,
  technicalSpecifications: z.array(fieldSchema).max(20),
  includedItems: z.array(fieldSchema).max(20),
  excludedItems: z.array(fieldSchema).max(20),
  warranty: fieldSchema,
  nettPrice: fieldSchema,
  promotionalPrice: fieldSchema,
  warnings: z.array(fieldSchema).max(20),
  productCount: z.number().int().min(0).max(20),
  mainProductBoundingBox: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).optional(),
  excludedBadgeRegions: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) })).max(20).optional(),
  visualSummary: z.object({
    mainProduct: z.string(),
    accessories: z.array(z.string()),
    packaging: z.array(z.string()),
    compatibilityOnly: z.array(z.string()),
    decorative: z.array(z.string()),
  }),
  analysisWarnings: z.array(z.string()),
}).transform(excludeSupplierBadges);

export const pdfImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  size: z.number().int().positive().max(30 * 1024 * 1024),
  pageCount: z.number().int().positive().max(100),
});

export const pageAnalysisRequestSchema = z.object({
  embeddedText: z.string().max(100_000).default(""),
  pagePreviewDataUrl: z.string().regex(/^data:image\/(png|jpeg);base64,/).max(12_000_000),
});

export const MULTI_PRODUCT_DECISIONS = ["SEPARATE_ADVERTS", "COMBINED_ADVERT", "CHOOSE_ONE", "MANUAL_REVIEW"] as const;

const missing = (page: number): ExtractedField => ({ value: "Not found", confidence: "LOW", source: "NOT_FOUND", sourcePage: page });
const found = (value: string, page: number, confidence: Confidence = "HIGH", source: ExtractedField["source"] = "EMBEDDED_TEXT"): ExtractedField => ({ value: normalizeTechnicalText(value), confidence, source, sourcePage: page });

export function normalizeTechnicalText(value: string) {
  const units: Record<string, string> = { mm: "mm", cm: "cm", m: "m", v: "V", w: "W", kw: "kW", ah: "Ah", mah: "mAh", l: "L", kg: "kg" };
  return value
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*(mah|mm|cm|kw|ah|kg|m|v|w|l)\b/gi, (_, number, unit) => `${number} ${units[String(unit).toLowerCase()]}`)
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)\s*/g, ") ")
    .trim();
}

function firstMatch(text: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

export function heuristicPageAnalysis(rawText: string, ocrText: string, page: number): PdfPageAnalysis {
  const combined = `${rawText}\n${ocrText}`.replace(/\r/g, "");
  const source: ExtractedField["source"] = rawText.trim() ? "EMBEDDED_TEXT" : ocrText.trim() ? "OCR" : "NOT_FOUND";
  const brandValue = /\bINGCO\b/i.test(combined) ? "INGCO" : firstMatch(combined, [/\bBrand\s*[:\-]\s*([^\n]+)/i]);
  const skuValue = firstMatch(combined, [/\b(?:SKU|product\s*code|item\s*code)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i]);
  const modelValue = firstMatch(combined, [/\bmodel\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i]);
  const priceValue = firstMatch(combined, [/\bnett?\s*(?:price)?\s*[\s:R$]*([0-9][0-9 ,.]+)/i]);
  const wasValue = firstMatch(combined, [/\bWAS\s*(?:price)?\s*[\s:R$]*([0-9][0-9 ,.]+)/i]);
  const nowValue = firstMatch(combined, [/\bNOW\s*(?:price)?\s*[\s:R$]*([0-9][0-9 ,.]+)/i]);
  const productBlocks = combined.split(/(?=\bProduct(?: name)?\s*[:\-])/i).filter(s=>/^Product(?: name)?\s*[:\-]/i.test(s));
  const promoValue = nowValue || firstMatch(combined, [/\b(?:promo(?:tional)?|selling|special)\s*price\s*[\s:R$]*([0-9][0-9 ,.]+)/i]);
  const productNameValue = firstMatch(combined, [/\bproduct\s*(?:name)?\s*[:\-]\s*([^\n]+)/i, /\b(CORDLESS\s+[A-Z0-9 -]{3,}|RECIPROCATING\s+SAW[A-Z0-9 -]*)\b/i]);
  const specs: ExtractedField[] = [];
  const patterns = [
    /\bWood\s*[:\-]?\s*(\d+\s*mm(?:\s*\([^)]*\))?)/gi,
    /\bMetal\s*[:\-]?\s*(\d+\s*mm(?:\s*\([^)]*\))?)/gi,
    /\b(\d+(?:\.\d+)?\s*(?:V|W|KW|AH|MAH|MM|CM|KG|L))\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      const value = match[0].includes(":") ? match[0] : match[1];
      if (value && !specs.some((item) => item.value.toLowerCase() === normalizeTechnicalText(value).toLowerCase())) specs.push(found(value, page, "MEDIUM", source));
    }
  }
  const excluded: ExtractedField[] = [];
  const soldSeparately = combined.match(/(?:battery|batteries)(?:\s+and\s+charger)?\s+(?:are\s+)?sold\s+separately/i)?.[0];
  if (soldSeparately) excluded.push(found(soldSeparately, page, "HIGH", source));
  const analysisWarnings = ["Automated visual classification was unavailable; verify the main product image manually."];
  if (!skuValue) analysisWarnings.push("Product code / SKU was not found.");
  if (!priceValue && !promoValue) analysisWarnings.push("No confirmed price was found; selling price cannot be calculated.");
  const result = excludeSupplierBadges({
    brand: brandValue ? found(brandValue, page, "HIGH", source) : missing(page),
    productName: productNameValue ? found(productNameValue, page, "MEDIUM", source) : missing(page),
    category: missing(page), model: modelValue ? found(modelValue, page, "MEDIUM", source) : missing(page),
    sku: skuValue ? found(skuValue, page, "HIGH", source) : missing(page),
    wasPrice: wasValue ? found(wasValue,page,"HIGH",source) : missing(page),
    technicalSpecifications: specs, includedItems: [], excludedItems: excluded, powerInclusion: detectPowerInclusion(combined),
    warranty: missing(page), nettPrice: priceValue ? found(priceValue, page, "MEDIUM", source) : missing(page),
    promotionalPrice: promoValue ? found(promoValue, page, "MEDIUM", source) : missing(page), warnings: excluded,
    productCount: productNameValue ? 1 : 0,
    visualSummary: { mainProduct: "Unclear — review required", accessories: [], packaging: [], compatibilityOnly: soldSeparately ? ["Battery / charger"] : [], decorative: [] },
    analysisWarnings,
  });
  if(productBlocks.length>1){result.productCount=productBlocks.length;result.detectedProducts=productBlocks.map(s=>({name:s.split("\n")[0].replace(/^Product(?: name)?\s*[:\-]\s*/i,""),sourceText:s}));result.technicalSpecifications=[];result.productName=missing(page);result.sku=missing(page);result.nettPrice=missing(page);result.promotionalPrice=missing(page);result.wasPrice=missing(page);result.powerInclusion=detectPowerInclusion("");result.includedItems=[];result.excludedItems=[];result.warnings=[];result.analysisWarnings.push("Multiple products detected. Select one and confirm its individual facts; combined/separate generation is not automatic.");}
  return result;
}

export function parseMoney(value: string) {
  if (!value || /not found|unclear/i.test(value)) return null;
  const parsed = Number(value.replace(/[^0-9.,-]/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateToolhubPrice(nettPrice: string) {
  const nett = parseMoney(nettPrice);
  if (nett === null) return null;
  return { nettPrice: nett, markupPercent: 55.8, sellingPrice: Math.round(nett * 1.558), formula: "nett price × 1.558, rounded to nearest rand" };
}

export function coreReviewIssues(analysis: PdfPageAnalysis, options?: { selectedImageReady?: boolean; multiProductDecision?: string | null; pricingValid?: boolean }) {
  const issues: string[] = [];
  for (const [label, field] of [["Product name", analysis.productName], ["Product code / SKU", analysis.sku]] as const) {
    if (label === "Product code / SKU" && field.value === "Not found" && analysis.skuNotFoundAcknowledged) continue;
    if (field.value === "Not found" || field.value.startsWith("Unclear") || field.confidence === "LOW") issues.push(`${label} requires confirmation.`);
  }
  if (analysis.productCount > 1 && options?.multiProductDecision && options.multiProductDecision !== "CHOOSE_ONE") issues.push("Separate/combined adverts require individual reviewed product records. Choose one product for this page or use separate single-product imports.");
  if (analysis.productCount > 1 && options?.multiProductDecision === "CHOOSE_ONE" && (analysis.productName.source !== "USER" || analysis.technicalSpecifications.some(f=>f.source!=="USER"))) issues.push("Confirm the selected product name and its individual specifications.");
  if (analysis.technicalSpecifications.some(f=>f.confidence === "LOW")) issues.push("Confirm low-confidence technical specifications.");
  if (analysis.productCount > 1 && !options?.multiProductDecision) issues.push("Choose how this multi-product page should be handled.");
  if (options?.pricingValid !== true && !parseMoney(analysis.nettPrice.value) && !parseMoney(analysis.promotionalPrice.value)) issues.push("Confirm a nett or promotional selling price.");
  if (options?.selectedImageReady === false) issues.push("Select and process the main product image.");
  return issues;
}

export function isSafeProductCrop(box?: SourceRegion) {
  return Boolean(box && box.width * box.height < 0.9 && box.width >= 0.03 && box.height >= 0.03);
}
