import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MALE_CHARACTERS = ["laugh", "smile", "thumbs-up", "wink", "wonder", "wow"];

test("male character assets are transparent PNG files", () => {
for (const character of MALE_CHARACTERS) {
const image = readFileSync(new URL(`../public/toolhub/character-male-${character}.png`, import.meta.url));
assert.equal(image.subarray(1, 4).toString(), "PNG");
const colorType = image[25];
const hasTransparencyChunk = image.includes(Buffer.from("tRNS"));
assert.ok(colorType === 4 || colorType === 6 || hasTransparencyChunk, `${character} must include transparency`);
}
});

