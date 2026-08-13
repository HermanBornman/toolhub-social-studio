export const BACKGROUND_REMOVAL_STATUSES = ["PENDING", "PROCESSING", "COMPLETE", "FAILED"] as const;

export type BackgroundRemovalStatus = (typeof BACKGROUND_REMOVAL_STATUSES)[number];

export type ProductImageState = {
  originalImageUrl: string;
  processedImageUrl: string;
  backgroundRemovalStatus: BackgroundRemovalStatus;
  useOriginalImage: boolean;
};

export const PRODUCT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateProductImageUpload(file: { type: string; size: number }) {
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPG, or WEBP image";
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return "Image must be smaller than 8 MB";
  if (file.size === 0) return "The selected image is empty";
  return null;
}

export function selectProductImage(state: ProductImageState) {
  if (state.useOriginalImage) return state.originalImageUrl;
  if (state.backgroundRemovalStatus === "COMPLETE") return state.processedImageUrl;
  return "";
}

export function isProductImageReady(state: ProductImageState) {
  return Boolean(selectProductImage(state));
}

