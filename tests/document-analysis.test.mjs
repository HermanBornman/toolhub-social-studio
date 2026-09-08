import test from "node:test";
import assert from "node:assert/strict";
import { analyseProductText, hasLowConfidence, normalizeUnits } from "../lib/document-analysis.ts";

test("normalises units without changing their meaning", () => {
  assert.equal(normalizeUnits('20v cordless drill 150mm(6") 4.0ah'), '20 V cordless drill 150 mm (6") 4.0 Ah');
});

test("extracts verified fields and nett pricing from embedded PDF text", () => {
  const text = [
    "INGCO",
    "20V CORDLESS ROTARY HAMMER",
    "MODEL: CRHLI26208",
    "2.5J IMPACT ENERGY",
    "26MM CONCRETE CAPACITY",
    "BATTERY AND CHARGER SOLD SEPARATELY",
    "NETT PRICE R 1 349,79",
  ].join("\n");
  const result = analyseProductText(text, "");
  assert.equal(result.brand.value, "INGCO");
  assert.equal(result.model.value, "CRHLI26208");
  assert.equal(result.nettPrice.value, 1349.79);
  assert.match(result.excluded[0].value, /SOLD SEPARATELY/i);
  assert.equal(result.title.confidence, "high");
});

test("uses OCR for a scanned page and marks the fields medium confidence", () => {
  const result = analyseProductText("", "INGCO\n20V CORDLESS FAN\nMODEL CFALI2002\n20 V\nNETT PRICE R980.00");
  assert.equal(result.model.value, "CFALI2002");
  assert.equal(result.model.source, "ocr");
  assert.equal(result.model.confidence, "medium");
});

test("does not invent a missing nett price", () => {
  const result = analyseProductText("INGCO\nANGLE GRINDER\nMODEL AG75028", "");
  assert.equal(result.nettPrice.value, null);
  assert.equal(result.nettPrice.confidence, "low");
  assert.equal(hasLowConfidence(result), true);
});

test("flags a page containing multiple product codes", () => {
  const result = analyseProductText("MODEL CIDLI209689\nMODEL CRHLI26208\nNETT PRICE R1000", "");
  assert.ok(result.possibleProductCount > 1);
  assert.ok(result.warnings.some((warning) => /multi-product/i.test(warning)));
});

test("does not treat a promotional price as a nett price", () => {
  const result = analyseProductText("INGCO FAN\nMODEL CFALI2002\nSPECIAL PRICE R980", "");
  assert.equal(result.nettPrice.value, null);
  assert.equal(result.promotionalPrice.value, 980);
});

test("rejects an ambiguous OCR nett-price digit grouping", () => {
  const result = analyseProductText("", "MODEL CKLI20358\nNET R 2819 9");
  assert.equal(result.nettPrice.value, null);
  assert.match(result.warnings.join(" "), /Nett price not found or unclear/i);
});

test("ambiguous multiple amounts cannot become nett cost", () => {
 assert.equal(analyseProductText("NETT R1000 SPECIAL R1200", "").nettPrice.value, null);
});
