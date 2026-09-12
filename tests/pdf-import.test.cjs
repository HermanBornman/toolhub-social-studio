const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateToolhubPrice, coreReviewIssues, heuristicPageAnalysis, isSafeProductCrop, normalizeTechnicalText, pdfImportSchema } = require("../.test-dist/lib/pdf-import.js");

test("normalizes technical spacing without changing unit meaning", () => {
  assert.equal(normalizeTechnicalText('150mm(6") 20v 2.0Ah'), '150 mm (6") 20 V 2.0 Ah');
});

test("extracts the reciprocating saw facts without inventing SKU or price", () => {
  const analysis = heuristicPageAnalysis("INGCO P20S BL MOTOR RECIPROCATING SAW Wood: 210mm Metal: 12mm Battery and charger sold separately", "", 1);
  assert.equal(analysis.brand.value, "INGCO");
  assert.match(analysis.productName.value, /RECIPROCATING SAW/i);
  assert.ok(analysis.technicalSpecifications.some((item) => /Wood: 210 mm/i.test(item.value)));
  assert.ok(analysis.technicalSpecifications.some((item) => /Metal: 12 mm/i.test(item.value)));
  assert.ok(analysis.excludedItems.some((item) => /sold separately/i.test(item.value)));
  assert.equal(analysis.sku.value, "Not found");
  assert.equal(analysis.nettPrice.value, "Not found");
});

test("uses OCR text when a scanned page has no embedded text", () => {
  const analysis = heuristicPageAnalysis("", "Brand: INGCO Product: CORDLESS DRILL 20v", 2);
  assert.equal(analysis.brand.source, "OCR");
  assert.equal(analysis.productName.source, "OCR");
  assert.equal(analysis.productName.sourcePage, 2);
});

test("calculates Toolhub selling price only from a valid nett price", () => {
  assert.deepEqual(calculateToolhubPrice("R 1,000.00"), { nettPrice: 1000, markupPercent: 55.8, sellingPrice: 1558, formula: "nett price × 1.558, rounded to nearest rand" });
  assert.equal(calculateToolhubPrice("Not found"), null);
});

test("blocks review when core facts, price, image or multi-product choice are unresolved", () => {
  const analysis = heuristicPageAnalysis("INGCO Product: CORDLESS DRILL", "", 1);
  analysis.productCount = 2;
  const issues = coreReviewIssues(analysis, { selectedImageReady: false });
  assert.ok(issues.some((issue) => /SKU/i.test(issue)));
  assert.ok(issues.some((issue) => /price/i.test(issue)));
  assert.ok(issues.some((issue) => /multi-product/i.test(issue)));
  assert.ok(issues.some((issue) => /image/i.test(issue)));
});

test("never accepts a whole-page region as a product crop", () => {
  assert.equal(isSafeProductCrop({ x: 0, y: 0, width: 1, height: 1 }), false);
  assert.equal(isSafeProductCrop({ x: .2, y: .2, width: .5, height: .5 }), true);
});

test("validates single and multi-page PDF metadata with one-advert-per-page handled by persistence", () => {
  assert.equal(pdfImportSchema.safeParse({ filename: "one.pdf", mimeType: "application/pdf", size: 1000, pageCount: 1 }).success, true);
  assert.equal(pdfImportSchema.safeParse({ filename: "many.pdf", mimeType: "application/pdf", size: 1000, pageCount: 8 }).success, true);
  assert.equal(pdfImportSchema.safeParse({ filename: "bad.pdf", mimeType: "application/pdf", size: 1000, pageCount: 0 }).success, false);
});
test("permanent badge policy removes P20S and BL MOTOR while preserving real specifications", () => {
  const { heuristicPageAnalysis, pdfPageAnalysisSchema } = require("../.test-dist/lib/pdf-import.js");
  const analysis = heuristicPageAnalysis("INGCO\nProduct: P20S BL MOTOR Reciprocating saw\nWood: 210mm\nMetal: 12mm\nBattery and charger sold separately", "", 1);
  const item = value => ({ value, confidence: "HIGH", source: "USER", sourcePage: 1 });
  analysis.technicalSpecifications.push(item("p20s platform"), item("BL-Motor"), item("Brushless"));
  analysis.model = item("P20S");
  analysis.excludedBadgeRegions = [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }];
  const saved = pdfPageAnalysisSchema.parse(analysis);
  assert.equal(saved.productName.value, "Reciprocating saw");
  assert.equal(saved.model.value, "Not found");
  assert.ok(saved.technicalSpecifications.some(item => /Wood.*210 mm/.test(item.value)));
  assert.ok(saved.technicalSpecifications.some(item => item.value === "Brushless"));
  assert.ok(saved.excludedItems.some(item => /sold separately/i.test(item.value)));
  assert.ok(saved.technicalSpecifications.every(item => !/P20S|BL[ -]*MOTOR/i.test(item.value)));
  assert.equal(saved.excludedBadgeRegions.length, 1);
  assert.deepEqual(pdfPageAnalysisSchema.parse(saved), saved);
});

test("explicit unknown SKU acknowledgement preserves unknown identity",()=>{const a=heuristicPageAnalysis("Product: CORDLESS SAW", "",1);a.productName.confidence="HIGH";assert.ok(coreReviewIssues(a,{pricingValid:true}).some(x=>x.includes("SKU")));a.skuNotFoundAcknowledged=true;assert.ok(!coreReviewIssues(a,{pricingValid:true}).some(x=>x.includes("SKU")));assert.equal(a.sku.value,"Not found");});
