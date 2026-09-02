import test from "node:test";
import assert from "node:assert/strict";
import { calculateSellingPrice } from "../lib/pricing.ts";

const ingcoPrices = [
[2819.69, 4393],
[2611.07, 4068],
[2425.60, 3779],
[1349.79, 2103],
[491.75, 766],
[418.21, 652],
[310.75, 484],
];

test("INGCO launch nett prices receive the required 55.8% markup", () => {
for (const [nett, expected] of ingcoPrices) {
assert.equal(calculateSellingPrice(nett, 55.8), expected);
}
});
