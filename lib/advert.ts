import { z } from "zod";
import type { Mood } from "./moods";
import { BACKGROUND_REMOVAL_STATUSES, type BackgroundRemovalStatus } from "./product-image";

export const TEMPLATE_VERSION = "TOOLHUB_SOCIAL_MASTER_V1";

export const CAMPAIGN_TYPES = [
  "Standard Product",
  "Back In Stock",
  "New Product",
  "Special",
  "Weekend Special",
  "Product Launch",
  "Limited Stock",
  "Clearance",
  "Best Seller",
] as const;

export const CAMPAIGN_SUGGESTIONS: Record<(typeof CAMPAIGN_TYPES)[number], string> = {
  "Standard Product": "BUILT FOR THE JOB",
  "Back In Stock": "BACK IN STOCK",
  "New Product": "NEW PRODUCT",
  Special: "SPECIAL",
  "Weekend Special": "WEEKEND SPECIAL",
  "Product Launch": "PRODUCT LAUNCH",
  "Limited Stock": "LIMITED STOCK",
  Clearance: "CLEARANCE",
  "Best Seller": "BEST SELLER",
};

export type AdvertFormData = {
  productId?: string;
  productName: string;
  sku: string;
  primarySpecification: string;
  secondarySpecification: string;
  feature01: string;
  feature02: string;
  keyBenefit: string;
  campaignType: (typeof CAMPAIGN_TYPES)[number];
  campaignMessage: string;
  sellingPrice: string;
  disclaimer: string;
  moodId: Mood;
  originalImageUrl: string;
  processedImageUrl: string;
  backgroundRemovalStatus: BackgroundRemovalStatus;
  useOriginalImage: boolean;
  qrUrl: string;
};

export const TEST_ADVERT: AdvertFormData = {
  productId: undefined,
  productName: "20V CORDLESS DRILL KIT",
  sku: "TEST-CIDLI20",
  primarySpecification: "2 x 2.0Ah BATTERIES + CHARGER",
  secondarySpecification: "Compact, powerful drilling and screwdriving kit",
  feature01: "20V POWER",
  feature02: "2 BATTERIES",
  keyBenefit: "IDEAL FOR DIY & TRADE",
  campaignType: "Back In Stock",
  campaignMessage: "BACK IN STOCK",
  sellingPrice: "2499",
  disclaimer: "WHILE STOCKS LAST",
  moodId: "thumbs_up",
  originalImageUrl: "",
  processedImageUrl: "",
  backgroundRemovalStatus: "PENDING",
  useOriginalImage: false,
  qrUrl: "https://www.toolhub.co.za",
};

export const advertSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().trim().min(1, "Product Name is required").max(60, "Keep Product Name under 60 characters"),
  sku: z.string().trim().min(1, "SKU is required").max(32),
  primarySpecification: z.string().trim().min(1, "Primary Specification is required").max(70),
  secondarySpecification: z.string().trim().max(110),
  feature01: z.string().trim().max(28),
  feature02: z.string().trim().max(28),
  keyBenefit: z.string().trim().max(42),
  campaignType: z.enum(CAMPAIGN_TYPES),
  campaignMessage: z.string().trim().min(1).max(32, "Keep Campaign Message under 32 characters"),
  sellingPrice: z.coerce.number().int().positive("Selling Price must be greater than zero"),
  disclaimer: z.string().trim().max(50),
  moodId: z.enum(["happy", "excited", "wow", "wink", "thumbs_up", "smile"]),
  originalImageUrl: z.string().min(1, "Product Image is required"),
  processedImageUrl: z.string(),
  backgroundRemovalStatus: z.enum(BACKGROUND_REMOVAL_STATUSES),
  useOriginalImage: z.boolean(),
  qrUrl: z.string().url("Enter a valid QR URL"),
}).superRefine((data, context) => {
  const transparentReady = data.backgroundRemovalStatus === "COMPLETE" && data.processedImageUrl.startsWith("data:image/png;base64,");
  if (!transparentReady && !data.useOriginalImage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["originalImageUrl"],
      message: "Background removal must complete before saving or exporting",
    });
  }
});
