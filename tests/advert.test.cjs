const test = require("node:test");
const assert = require("node:assert/strict");
const { advertSchema, TEST_ADVERT, TEMPLATE_VERSION } = require("../.test-dist/lib/advert.js");
const { MASCOT_MOODS } = require("../.test-dist/lib/moods.js");

test("accepts the supplied advert when a product image is present", () => {
  assert.equal(advertSchema.safeParse({ ...TEST_ADVERT, productImage: "data:image/png;base64,abc" }).success, true);
});

test("blocks missing critical fields", () => {
  assert.equal(advertSchema.safeParse({ ...TEST_ADVERT, productName: "", productImage: "" }).success, false);
});

test("keeps approved moods data-driven and the template version locked", () => {
  assert.deepEqual(MASCOT_MOODS.map((mood) => mood.id), ["happy","excited","wow","wink","thumbs_up","smile"]);
  assert.equal(TEMPLATE_VERSION, "TOOLHUB_SOCIAL_MASTER_V1");
});

