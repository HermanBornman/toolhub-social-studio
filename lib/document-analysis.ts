import type { ConfidenceLevel, ExtractedValue, ExtractionSource, ProductAnalysis } from "./types";

const NOT_FOUND = "Not found";
const PRICE_LINE = /\b(?:price|nett|net|list|promo|special|rrp|5\s*\+\s*1|10\s*\+\s*3)\b/i;
const EXCLUDED_LINE = /\b(?:sold separately|not included|excluded|bare tool|tool only)\b/i;
const INCLUDED_LINE = /\b(?:included|includes|supplied with|complete with|in the box)\b/i;
const WARRANTY_LINE = /\b(?:warranty|guarantee)\b/i;
const DECORATIVE_LINE = /\b(?:new product launch|professional tools|made affordable|scan to shop|follow us|promotion|special offer)\b/i;
const SPEC_SIGNAL = /(?:\d\s*(?:V|W|KW|AH|MAH|MM|CM|M|KG|NM|J|RPM|L|ML|BAR|PSI|HZ|PCS|PC|INCH|\")\b|brushless|capacity|torque|speed|diameter|input power|working range|accuracy|frequency|load|stroke|chuck|blade|battery|charger)/i;
const KNOWN_BRANDS = ["INGCO", "WADFOW", "RICOTA", "TOTAL", "DULUX", "SOUDAL", "WOODoc", "SPRAYMATE"];

function cleanLine(value: string) {
  return value.replace(/[|•·]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeUnits(value: string) {
  return cleanLine(value)
    .replace(/(\d)\s*(mm|cm|km|kg|kw|mah|ah|nm|rpm|psi|bar|hz|ml|pcs?|v|w|j|l)\b/gi, (_all, number, unit) => `${number} ${{mm: "mm", cm: "cm", km: "km", kg: "kg", kw: "kW", mah: "mAh", ah: "Ah", nm: "Nm", rpm: "rpm", psi: "psi", bar: "bar", hz: "Hz", ml: "ml", pc: "pc", pcs: "pcs", v: "V", w: "W", j: "J", l: "L"}[String(unit).toLowerCase()]}`)
    .replace(/(\d)\s*mm\s*\(\s*(\d+(?:\.\d+)?)\s*(?:in|inch|\")\s*\)/gi, "$1 mm ($2\")")
    .replace(/(\d)\s*x\s*(\d)/gi, "$1 × $2")
    .replace(/\s+([,;:)])/g, "$1")
    .replace(/([(])\s+/g, "$1");
}

function linesFrom(text: string) {
  const seen = new Set<string>();
  return text.split(/\r?\n/).map(cleanLine).filter((line) => {
    if (!line || line.length > 180) return false;
    const key = line.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function confidenceFor(value: string, embeddedText: string, ocrText: string): { confidence: ConfidenceLevel; source: ExtractionSource } {
  if (!value || value === NOT_FOUND) return { confidence: "low", source: embeddedText ? "embedded-text" : "ocr" };
  const comparable = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const target = comparable(value);
  const inEmbedded = target.length > 2 && comparable(embeddedText).includes(target);
  const inOcr = target.length > 2 && comparable(ocrText).includes(target);
  if (inEmbedded && inOcr) return { confidence: "high", source: "embedded-text" };
  if (inEmbedded) return { confidence: "high", source: "embedded-text" };
  return { confidence: "medium", source: "ocr" };
}

function field(value: string, embeddedText: string, ocrText: string, note?: string): ExtractedValue<string> {
  const clean = value ? normalizeUnits(value) : NOT_FOUND;
  return { value: clean, ...confidenceFor(clean, embeddedText, ocrText), note };
}

function parseMoney(raw: string) {
  const digitsAndSpacing = raw.replace(/[^\d.,\s]/g, "").trim();
  if (!/[.,]/.test(digitsAndSpacing)) {
    const groups = digitsAndSpacing.split(/\s+/).filter(Boolean);
    if (groups.length === 2 && groups[0].length > 3 && groups[1].length !== 2) return null;
    if (groups.length > 2 && groups.at(-1)?.length !== 2 && !groups.slice(1).every((group) => group.length === 3)) return null;
  }
  const compact = digitsAndSpacing.replace(/\s/g, "").replace(/,(?=\d{2}\b)/, ".").replace(/[^\d.]/g, "");
  const value = Number(compact);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function labelledPrice(lines: string[], labels: RegExp[]) {
  for (const line of lines) {
    if (!labels.some((label) => label.test(line))) continue;
    const matches = [...line.matchAll(/(?:R\s*)?([0-9][0-9\s,.]{1,12})/gi)];
    if (matches.length !== 1) return { value: null, line };
    const match = matches[0]?.[1];
    if (match) return { value: parseMoney(match), line };
  }
  return { value: null, line: "" };
}

function priceField(value: number | null, sourceLine: string, embeddedText: string, ocrText: string): ExtractedValue<number | null> {
  if (value === null) return { value: null, confidence: "low", source: embeddedText ? "embedded-text" : "ocr", note: NOT_FOUND };
  const origin = confidenceFor(sourceLine, embeddedText, ocrText);
  return { value, ...origin, note: sourceLine };
}

function findModel(lines: string[]) {
  for (const line of lines) {
    const labelled = line.match(/(?:MODEL|ITEM|PRODUCT\s*CODE|SKU|CODE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]{3,})/i);
    if (labelled?.[1] && !/^\d{12,14}$/.test(labelled[1])) return labelled[1].toUpperCase();
  }
  for (const line of lines) {
    const candidate = line.match(/\b([A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]{3,})\b/);
    if (candidate?.[1] && !/^\d{12,14}$/.test(candidate[1])) return candidate[1].toUpperCase();
  }
  return "";
}

function findTitle(lines: string[], model: string) {
  const candidates = lines.filter((line) => {
    if (line.length < 8 || line.length > 82 || PRICE_LINE.test(line) || DECORATIVE_LINE.test(line)) return false;
    if (model && line.toUpperCase() === model) return false;
    if (WARRANTY_LINE.test(line) || INCLUDED_LINE.test(line) || EXCLUDED_LINE.test(line)) return false;
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    return letters >= 6;
  });
  return candidates.find((line) => SPEC_SIGNAL.test(line) && /[A-Z]{3}/.test(line))
    || candidates.find((line) => /[A-Z]{3}/.test(line))
    || candidates[0]
    || "";
}

function findDescription(lines: string[], title: string) {
  return lines.find((line) => line !== title && line.length >= 24 && line.length <= 110 && !PRICE_LINE.test(line)
    && !SPEC_SIGNAL.test(line) && !DECORATIVE_LINE.test(line) && !INCLUDED_LINE.test(line) && !EXCLUDED_LINE.test(line)) || "";
}

function detectBrand(text: string) {
  const upper = text.toUpperCase();
  return KNOWN_BRANDS.find((brand) => upper.includes(brand.toUpperCase())) || "";
}

function detectCategory(title: string) {
  const categories = ["BATTERY", "ANGLE GRINDER", "IMPACT DRILL", "IMPACT WRENCH", "ROTARY HAMMER", "FAN", "TOOL BAG", "SPRAY GUN", "LASER LEVEL", "COMBO KIT", "HAND TOOLS SET"];
  return categories.find((category) => title.toUpperCase().includes(category)) || "";
}

export function analyseProductText(embeddedText: string, ocrText: string): ProductAnalysis {
  const combined = [embeddedText, ocrText].filter(Boolean).join("\n");
  const lines = linesFrom(combined);
  const model = findModel(lines);
  const barcode = combined.match(/\b\d{12,14}\b/)?.[0] || "";
  const skuLine = lines.find((line) => /\bSKU\b/i.test(line)) || "";
  const sku = skuLine.match(/\bSKU\s*[:#-]?\s*([A-Z0-9./-]{3,})/i)?.[1] || "";
  const title = findTitle(lines, model);
  const description = findDescription(lines, title);
  const brand = detectBrand(combined);
  const nett = labelledPrice(lines, [/\bNETT?\b/i, /\bNET\s+PRICE\b/i]);
  const promo = labelledPrice(lines, [/\bPROMO(?:TIONAL)?\b/i, /\bSPECIAL\s+PRICE\b/i, /\bSELLING\s+PRICE\b/i]);
  const specs = lines.filter((line) => SPEC_SIGNAL.test(line) && !PRICE_LINE.test(line) && !DECORATIVE_LINE.test(line)
    && !INCLUDED_LINE.test(line) && !EXCLUDED_LINE.test(line) && line !== title && line.length <= 72).slice(0, 12);
  const included = lines.filter((line) => INCLUDED_LINE.test(line)).slice(0, 8);
  const excluded = lines.filter((line) => EXCLUDED_LINE.test(line)).slice(0, 8);
  const warranty = lines.find((line) => WARRANTY_LINE.test(line)) || "";
  const modelMatches = new Set([...combined.matchAll(/\b[A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]{3,}\b/g)].map((match) => match[0]).filter((value) => !/^\d{12,14}$/.test(value)));
  const possibleProductCount = Math.max(1, Math.min(10, modelMatches.size || 1));
  const warnings: string[] = [];
  if (!title) warnings.push("Product name not found");
  if (!model) warnings.push("Product model not found");
  if (nett.value === null) warnings.push("Nett price not found or unclear—confirmation required");
  if (!specs.length) warnings.push("No confirmed technical specifications found");
  if (possibleProductCount > 1) warnings.push(`Possible multi-product page: ${possibleProductCount} product codes detected`);

  return {
    brand: field(brand, embeddedText, ocrText),
    title: field(title, embeddedText, ocrText),
    category: field(detectCategory(title), embeddedText, ocrText),
    model: field(model, embeddedText, ocrText),
    sku: field(sku, embeddedText, ocrText),
    barcode: field(barcode, embeddedText, ocrText),
    description: field(description, embeddedText, ocrText),
    specs: specs.map((value) => field(value, embeddedText, ocrText)),
    included: included.map((value) => field(value, embeddedText, ocrText)),
    excluded: excluded.map((value) => field(value, embeddedText, ocrText)),
    warranty: field(warranty, embeddedText, ocrText),
    nettPrice: priceField(nett.value, nett.line, embeddedText, ocrText),
    promotionalPrice: priceField(promo.value, promo.line, embeddedText, ocrText),
    warnings,
    possibleProductCount,
  };
}

export function hasLowConfidence(analysis: ProductAnalysis) {
  return [analysis.title, analysis.model, analysis.nettPrice, ...analysis.specs].some((item) => item.confidence === "low");
}
