import sharp from "sharp";
import { decodeImageDataUrl, validatePng } from "./png-transparency";
export async function validateSourceImage(value: string) {
  const {mime,bytes} = decodeImageDataUrl(value);
  if (mime === "image/png") return validatePng(value);
  try {
    const image = sharp(bytes,{limitInputPixels:16_000_000,failOn:"warning"});
    const metadata = await image.metadata();
    if (`image/${metadata.format}` !== mime || (metadata.pages ?? 1) !== 1) throw new Error("INVALID_IMAGE_DATA");
    const {info} = await image.raw().toBuffer({resolveWithObject:true});
    return {width:info.width,height:info.height};
  } catch { throw new Error("INVALID_IMAGE_DATA"); }
}
export async function validateProductImages(input: {originalImageUrl:string;processedImageUrl?:string|null;backgroundRemovalStatus:string;useOriginalImage?:boolean}, requireReady=false) {
  if (input.originalImageUrl) await validateSourceImage(input.originalImageUrl);
  if (input.processedImageUrl) validatePng(input.processedImageUrl,{transparent:true});
  if ((input.backgroundRemovalStatus === "COMPLETE" || (requireReady && !input.useOriginalImage)) && !input.processedImageUrl) throw new Error("TRANSPARENT_PNG_REQUIRED");
  if (requireReady && !input.originalImageUrl) throw new Error("PRODUCT_IMAGE_REQUIRED");
}
