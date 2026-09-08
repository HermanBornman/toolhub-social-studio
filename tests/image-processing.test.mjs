import test from "node:test";
import assert from "node:assert/strict";
import { detectForegroundCrop, retainLargestAlphaComponent } from "../lib/image-processing.ts";

function whiteImage(width, height) {
const pixels = new Uint8ClampedArray(width * height * 4);
for (let index = 0; index < width * height; index++) {
pixels.set([255, 255, 255, 255], index * 4);
}
return pixels;
}

function paint(pixels, width, left, top, right, bottom, alpha = 255) {
for (let y = top; y <= bottom; y++) {
for (let x = left; x <= right; x++) pixels.set([20, 20, 20, alpha], (y * width + x) * 4);
}
}

test("automatic product crop follows the largest foreground subject", () => {
const pixels = whiteImage(100, 100);
paint(pixels, 100, 30, 30, 80, 60);
paint(pixels, 100, 72, 76, 92, 94);
const crop = detectForegroundCrop(pixels, 100, 100);

assert.ok(crop.x <= 0.21);
assert.ok(crop.y <= 0.21);
assert.ok(crop.x + crop.width <= 0.92);
assert.ok(crop.y + crop.height <= 0.72);
});

test("subject cleanup removes disconnected text and packaging components", () => {
const pixels = new Uint8ClampedArray(20 * 20 * 4);
paint(pixels, 20, 3, 4, 12, 13);
paint(pixels, 20, 16, 1, 18, 3);
const retained = retainLargestAlphaComponent(pixels, 20, 20);

assert.equal(retained, 100);
assert.equal(pixels[(5 * 20 + 5) * 4 + 3], 255);
assert.equal(pixels[(2 * 20 + 17) * 4 + 3], 0);
});
