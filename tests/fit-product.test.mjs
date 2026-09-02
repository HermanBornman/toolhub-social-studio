import test from "node:test";
import assert from "node:assert/strict";
import { fitProductBox } from "../lib/fit-product.ts";

test("landscape products fill the width without being cut off", () => {
const result = fitProductBox(1200, 600, 644, 374);
assert.equal(result.width, 644);
assert.equal(result.height, 322);
assert.ok(result.height <= 374);
});

test("portrait products fill the height and keep their proportions", () => {
const result = fitProductBox(500, 1000, 644, 374);
assert.equal(result.height, 374);
assert.equal(result.width, 187);
assert.equal(result.width / result.height, 0.5);
});

test("invalid source dimensions cannot create an overflowing box", () => {
assert.deepEqual(fitProductBox(0, 800, 644, 374), { width: 0, height: 0, scale: 0 });
});
