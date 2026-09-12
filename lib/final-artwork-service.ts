import { prisma } from "./prisma";
import type { Advertisement } from "@prisma/client";
import { artworkType, validateArtworkAsset } from "./final-artwork";
export async function getFinalArtwork(advert:Advertisement,stage:"SUBMITTED"|"APPROVED"="APPROVED") {
  const asset=await prisma.advertisementAsset.findFirst({where:{advertisementId:advert.id,type:artworkType(stage,advert)},orderBy:{createdAt:"desc"}});
  return validateArtworkAsset(advert,asset,stage);
}
