import { createHash } from "node:crypto";
import type { Advertisement, AdvertisementAsset } from "@prisma/client";
import { validatePng } from "./png-transparency";
const renderFields = ["id","productName","sku","primarySpecification","secondarySpecification","feature01","feature02","keyBenefit","campaignType","campaignMessage","powerInclusionJson","pricingMethod","wasPrice","nowPrice","sellingPrice","disclaimer","moodId","productImage","originalImageUrl","processedImageUrl","backgroundRemovalStatus","useOriginalImage","qrUrl","templateVersion","submittedAt"] as const;
export function advertFingerprint(advert: Pick<Advertisement,typeof renderFields[number]>) {
  return createHash("sha256").update(JSON.stringify(renderFields.map(key=>[key,advert[key]]))).digest("hex");
}
export function artworkType(stage:"SUBMITTED"|"APPROVED",advert:Advertisement) {return `FINAL_${stage}:${advertFingerprint(advert)}`;}
export function validateArtworkAsset(advert:Advertisement,asset:AdvertisementAsset|null,stage:"SUBMITTED"|"APPROVED"="APPROVED") {
  if (!asset || asset.advertisementId!==advert.id || asset.type!==artworkType(stage,advert) || asset.mimeType!=="image/png") throw new Error("FINAL_ARTWORK_MISSING");
  if (asset.path===advert.productImage || asset.path===advert.processedImageUrl || asset.path===advert.originalImageUrl) throw new Error("FINAL_ARTWORK_MISSING");
  validatePng(asset.path,{finalArtwork:true});
  return asset;
}
