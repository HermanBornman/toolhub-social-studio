import test from "node:test";
import assert from "node:assert/strict";
import { detectForegroundCrop, normalizeCutoutAlpha, retainLargestAlphaComponent } from "../lib/image-processing.ts";
test("preserves transparency, soft shadows and thin edges without fading opaque pixels", () => {
  for (const alpha of [0, 4, 24, 60, 120, 255]) assert.equal(normalizeCutoutAlpha(alpha), alpha);
});

test("automatic crop follows the largest product-shaped region", () => {
  const width = 100;
  const height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (left, top, right, bottom, red, green, blue) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const offset = (y * width + x) * 4;
      pixels[offset] = red; pixels[offset + 1] = green; pixels[offset + 2] = blue;
    }
  };
  paint(25, 28, 87, 63, 240, 125, 0);
  paint(4, 18, 27, 24, 20, 20, 20);
  paint(65, 70, 91, 86, 245, 140, 10);
  const crop = detectForegroundCrop(pixels, width, height);
  assert.ok(crop.x <= 0.25 && crop.y <= 0.28);
  assert.ok(crop.x + crop.width >= 0.87 && crop.y + crop.height >= 0.63);
  assert.ok(crop.y + crop.height < 0.8);
});

test("retains the primary cutout and removes disconnected supplier graphics", () => {
  const width = 20;
  const height = 12;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const opaque = (left, top, right, bottom) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) pixels[(y * width + x) * 4 + 3] = 255;
  };
  opaque(5, 3, 16, 9);
  opaque(1, 1, 2, 2);
  retainLargestAlphaComponent(pixels, width, height);
  assert.equal(pixels[(5 * width + 10) * 4 + 3], 255);
  assert.equal(pixels[(1 * width + 1) * 4 + 3], 0);
});
