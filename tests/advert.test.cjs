const test = require("node:test");
const assert = require("node:assert/strict");
const { advertSchema, TEST_ADVERT, TEMPLATE_VERSION } = require("../.test-dist/lib/advert.js");
const { MASCOT_MOODS } = require("../.test-dist/lib/moods.js");
const { isProductImageReady, selectProductImage, validateProductImageUpload } = require("../.test-dist/lib/product-image.js");
const { removeProductBackground } = require("../.test-dist/lib/remove-background.js");
const { canUseOriginalImage } = require("../.test-dist/lib/user-role.js");

const ORIGINAL = "data:image/jpeg;base64,original";
const PROCESSED = "data:image/png;base64,processed";
const COMPLETE_IMAGE = { originalImageUrl: ORIGINAL, processedImageUrl: PROCESSED, backgroundRemovalStatus: "COMPLETE", useOriginalImage: false };

test("accepts the supplied advert when a product image is present", () => {
  assert.equal(advertSchema.safeParse({ ...TEST_ADVERT, ...COMPLETE_IMAGE }).success, true);
});

test("blocks missing critical fields", () => {
  assert.equal(advertSchema.safeParse({ ...TEST_ADVERT, productName: "", originalImageUrl: "" }).success, false);
});

test("keeps approved moods data-driven and the template version locked", () => {
  assert.deepEqual(MASCOT_MOODS.map((mood) => mood.id), ["happy","excited","wow","wink","thumbs_up","smile"]);
  assert.deepEqual(MASCOT_MOODS.map((mood) => mood.assetPath), ["/mascots/happy.png","/mascots/excited.png","/mascots/wow.png","/mascots/wink.png","/mascots/thumbs-up.png","/mascots/smile.png"]);
  assert.equal(TEMPLATE_VERSION, "TOOLHUB_SOCIAL_MASTER_V1");
});

test("rejects copy that exceeds the safe locked-template capacity", () => {
  const result = advertSchema.safeParse({ ...TEST_ADVERT, ...COMPLETE_IMAGE, productName: "X".repeat(61) });
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /under 60 characters/);
});

test("requires completed processing for normal production", () => {
  assert.equal(isProductImageReady({ ...COMPLETE_IMAGE, backgroundRemovalStatus: "PROCESSING", processedImageUrl: "" }), false);
  assert.equal(advertSchema.safeParse({ ...TEST_ADVERT, originalImageUrl: ORIGINAL, backgroundRemovalStatus: "PROCESSING" }).success, false);
  assert.equal(advertSchema.safeParse({ ...TEST_ADVERT, originalImageUrl: ORIGINAL, backgroundRemovalStatus: "FAILED" }).success, false);
});

test("renderer chooses processed image and supports explicit original fallback", () => {
  assert.equal(selectProductImage(COMPLETE_IMAGE), PROCESSED);
  assert.equal(selectProductImage({ ...COMPLETE_IMAGE, useOriginalImage: true }), ORIGINAL);
});

test("PNG export readiness resolves to the processed transparent image", () => {
  assert.equal(isProductImageReady(COMPLETE_IMAGE), true);
  assert.match(selectProductImage(COMPLETE_IMAGE), /^data:image\/png;base64,/);
});

test("original fallback is restricted to Marketing and Admin", () => {
  assert.equal(canUseOriginalImage("STAFF"), false);
  assert.equal(canUseOriginalImage("MARKETING"), true);
  assert.equal(canUseOriginalImage("ADMIN"), true);
});

test("rejects invalid uploads", () => {
  assert.match(validateProductImageUpload({ type: "application/pdf", size: 100 }), /PNG, JPG, or WEBP/);
  assert.match(validateProductImageUpload({ type: "image/png", size: 9 * 1024 * 1024 }), /smaller than 8 MB/);
});

test("background removal returns a transparent PNG and sends production parameters", async () => {
  const png = new Uint8Array(26);
  png.set([137,80,78,71,13,10,26,10]);
  png[25] = 6;
  let request;
  const fetcher = async (url, init) => { request = { url, init }; return new Response(png, { status: 200, headers: { "content-type": "image/png", "x-credits-charged": "1" } }); };
  const result = await removeProductBackground(new File(["image"], "kit.jpg", { type: "image/jpeg" }), "secret", fetcher);
  assert.match(result.processedImageUrl, /^data:image\/png;base64,/);
  assert.equal(request.url, "https://api.remove.bg/v1.0/removebg");
  assert.equal(request.init.headers["X-Api-Key"], "secret");
  assert.equal(request.init.body.get("format"), "png");
  assert.equal(request.init.body.get("crop"), "true");
  assert.equal(request.init.body.get("semitransparency"), "true");
});

test("background removal reports quota failure", async () => {
  const fetcher = async () => new Response("quota", { status: 402 });
  await assert.rejects(() => removeProductBackground(new File(["image"], "kit.webp", { type: "image/webp" }), "secret", fetcher), /quota exceeded/);
});
