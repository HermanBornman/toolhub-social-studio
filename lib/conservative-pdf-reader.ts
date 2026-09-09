import type { SupplierReading, ReadField, ReadProduct } from "./supplier-reading";

const value = (text: string | null, evidence = text || ""): ReadField => ({ value: text, confidence: text ? "medium" : "low", evidence });
export function readVisibleText(rawText: string): SupplierReading {
  const lines = rawText.split(/\r?\n/).map(line => line.replace(/\s+/g," ").trim()).filter(Boolean);
  const joined = lines.join(" ");
  // A capacity label, platform logo or a random OCR fragment is never a product title.
  const title = lines.find(line => /\b(reciprocating saw|circular saw|angle grinder|impact drill|rotary hammer|cordless fan|floor fan|tool bag)\b/i.test(line) && !/\b(blade|capacity|price)\b/i.test(line));
  const model = joined.match(/\b(?:model|sku|product code)\s*[:#-]?\s*([A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]*)\b/i)?.[1] || null;
  const specs: ReadField[] = [];
  for (const material of ["Wood","Metal"]) {
    const match = joined.match(new RegExp(`\\b${material}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*mm\\b`,"i"));
    if (match) specs.push(value(`${material} cutting capacity: ${match[1]} mm`,match[0]));
  }
  if (/\bbrushless\b|\bBL\s*MOTOR\b/i.test(joined)) specs.push(value("Brushless motor",joined.match(/\bbrushless\b|\bBL\s*MOTOR\b/i)![0]));
  const platform = joined.match(/\bP20S\b/i);
  const voltage = joined.match(/\b(\d+(?:\.\d+)?)\s*V(?:\s*MAX)?\b/i);
  if (voltage) specs.push(value(`${voltage[1]} V${platform ? " P20S platform" : ""}`,voltage[0]));
  else if (platform) specs.push(value("P20S platform",platform[0]));
  const excluded: ReadField[] = [];
  const exclusion = joined.match(/batter(?:y|ies)\s*(?:and|&)\s*charger\s*(?:are\s*)?(?:sold separately|not included)/i);
  if (exclusion) excluded.push(value("Battery and charger sold separately",exclusion[0]));
  const product: ReadProduct = { brand:value(/\bingco\b/i.test(joined) ? "INGCO" : null),title:value(title || null),model:value(model),description:value(null),specs,included:[],excluded,nettPrice:value(null),promotionalPrice:value(null) };
  return { rawText, warnings:["Text-only fallback: verify against the page. Packaging and accessory labels are excluded from specifications.",...(!title ? ["Product name not found in text. Enter it manually or connect visual reading."] : [])],products:[product] };
}
