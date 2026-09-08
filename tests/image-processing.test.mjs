import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCutoutAlpha } from "../lib/image-processing.ts";
test("preserves transparency, soft shadows and thin edges without fading opaque pixels", () => {
  for (const alpha of [0, 4, 24, 60, 120, 255]) assert.equal(normalizeCutoutAlpha(alpha), alpha);
});
