import test from "node:test";
import assert from "node:assert/strict";
import { productFromOcr } from "../lib/pdf-processing.ts";

test("supplier artwork is classified into technical fields without inventing a model or price", () => {
const product = productFromOcr(`
P20S BL MOTOR
Wood: 210mm
Metal: 12mm
Battery
and charger
sold separately
`);

assert.equal(product.title, "PRODUCT NAME REQUIRED");
assert.equal(product.model, "");
assert.equal(product.prices.nett, undefined);
assert.deepEqual(product.specs, [
"BRUSHLESS MOTOR",
"210MM WOOD CUTTING CAPACITY",
"12MM METAL CUTTING CAPACITY",
"BATTERY & CHARGER SOLD SEPARATELY",
]);
});

test("an explicitly labelled model and nett price are extracted", () => {
const product = productFromOcr(`
20V CORDLESS RECIPROCATING SAW
MODEL: CRSLI1151
NETT PRICE R 1 349,79
WOOD: 210MM
METAL: 12MM
`);

assert.equal(product.title, "20V CORDLESS RECIPROCATING SAW");
assert.equal(product.model, "CRSLI1151");
assert.equal(product.prices.nett, 1349.79);
assert.deepEqual(product.specs.slice(0, 2), [
"210MM WOOD CUTTING CAPACITY",
"12MM METAL CUTTING CAPACITY",
]);
});
