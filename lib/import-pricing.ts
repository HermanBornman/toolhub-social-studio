import { z } from "zod";
import type { PdfPageAnalysis } from "./pdf-import";

export const PRICING_METHODS = ["PDF", "SALE", "MANUAL"] as const;
export const pricingInputSchema = z.object({
  method: z.enum(PRICING_METHODS).default("PDF"),
  pdfSource: z.enum(["NETT", "SELLING"]).default("NETT"),
  pdfDecision: z.enum(["UNCONFIRMED", "CONFIRMED", "REJECTED"]).default("UNCONFIRMED"),
  wasPrice: z.string().max(40).default(""), nowPrice: z.string().max(40).default(""),
  manualFinalSellingPrice: z.string().max(40).default(""),
});
export type PricingInput = z.infer<typeof pricingInputSchema>;
export type ExtractedPricing = { nettPrice: PdfPageAnalysis["nettPrice"]; sellingPrice: PdfPageAnalysis["promotionalPrice"]; wasPrice?: PdfPageAnalysis["wasPrice"] };
export function extractedPricing(analysis: PdfPageAnalysis): ExtractedPricing {
  return { nettPrice: { ...analysis.nettPrice }, sellingPrice: { ...analysis.promotionalPrice }, ...(analysis.wasPrice ? {wasPrice:{...analysis.wasPrice}} : {}) };
}
export function priceNumber(value: string): number | null {
  const clean = value.trim().replace(/^R\s*/i, "").replace(/[\s\u00a0\u202f]/g, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(clean)) return null;
  const number = Number(clean.replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 && number <= 2_147_483_647 ? number : null;
}
export function defaultPricing(source: ExtractedPricing): PricingInput {
  return pricingInputSchema.parse({ pdfSource: priceNumber(source.sellingPrice.value) ? "SELLING" : "NETT" });
}
export function resolvePricing(source: ExtractedPricing, input: PricingInput) {
  const errors: string[] = [];
  let finalSellingPrice: number | null = null, calculatedSellingPrice: number | null = null;
  const wasPrice = priceNumber(input.wasPrice), nowPrice = priceNumber(input.nowPrice), manualFinalSellingPrice = priceNumber(input.manualFinalSellingPrice);
  let formula = "";
  if (input.method === "SALE") {
    if (!wasPrice || Math.round(wasPrice) <= 0) errors.push("Enter a valid WAS price greater than zero.");
    if (!nowPrice || Math.round(nowPrice) <= 0) errors.push("Enter a valid NOW price greater than zero.");
    if (!errors.length) finalSellingPrice = Math.round(nowPrice!);
    formula = "User-entered NOW price, rounded to nearest rand";
  } else if (input.method === "MANUAL") {
    if (!manualFinalSellingPrice || Math.round(manualFinalSellingPrice) <= 0) errors.push("Enter a valid final selling price greater than zero.");
    else finalSellingPrice = Math.round(manualFinalSellingPrice);
    formula = "Manual final selling price overrides PDF prices, rounded to nearest rand";
  } else {
    const field = input.pdfSource === "NETT" ? source.nettPrice : source.sellingPrice;
    const value = priceNumber(field.value);
    if (input.pdfDecision !== "CONFIRMED") errors.push(input.pdfDecision === "REJECTED" ? "PDF price rejected. Choose sale or manual pricing." : "Confirm the extracted PDF price.");
    if (!value) errors.push("No valid PDF price available. Choose sale or manual pricing.");
    if (field.confidence === "LOW" || field.source === "NOT_FOUND") errors.push("PDF price confidence is low. Verify the price and enter it in manual or sale mode.");
    if (!errors.length) {
      if (input.pdfSource === "NETT") calculatedSellingPrice = Math.round(value! * 1.558);
      finalSellingPrice = calculatedSellingPrice ?? Math.round(value!);
      if (finalSellingPrice <= 0 || finalSellingPrice > 2_147_483_647) { errors.push("Final price is outside the supported range."); finalSellingPrice = null; }
    }
    formula = input.pdfSource === "NETT" ? "Confirmed PDF nett × 1.558, rounded to nearest rand" : "Confirmed PDF selling/promotional price, rounded to nearest rand";
  }
  return { ...input, extracted: source, wasPrice, nowPrice, manualFinalSellingPrice, calculatedSellingPrice, finalSellingPrice, formula, errors };
}
