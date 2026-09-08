import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCutoutAlpha } from "../lib/image-processing.ts";

test("retains anti-aliased thin product components", () => {
  assert.equal(normalizeCutoutAlpha(4), 0);
  assert.ok(normalizeCutoutAlpha(24) > 0);
  assert.ok(normalizeCutoutAlpha(60) > 100);
  assert.equal(normalizeCutoutAlpha(120), 255);
});
