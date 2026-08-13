import { z } from "zod";

const optionalUrl = z.string().trim().refine((value) => !value || z.string().url().safeParse(value).success, "Enter a valid URL");

export const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(32).transform((value) => value.toUpperCase()),
  barcode: z.string().trim().max(40).default(""),
  brand: z.string().trim().min(1, "Brand is required").max(40),
  productName: z.string().trim().min(1, "Product Name is required").max(80),
  category: z.string().trim().min(1, "Category is required").max(60),
  primarySpecification: z.string().trim().min(1, "Primary Specification is required").max(70),
  secondarySpecification: z.string().trim().max(110).default(""),
  feature01: z.string().trim().max(28).default(""),
  feature02: z.string().trim().max(28).default(""),
  keyBenefit: z.string().trim().max(42).default(""),
  normalPrice: z.coerce.number().int().nonnegative().nullable().optional(),
  currentPrice: z.coerce.number().int().positive("Current Selling Price must be greater than zero"),
  websiteUrl: optionalUrl.default(""),
  originalImageUrl: z.string().default(""),
  processedImageUrl: z.string().default(""),
  backgroundRemovalStatus: z.enum(["PENDING", "PROCESSING", "COMPLETE", "FAILED"]).default("PENDING"),
  active: z.boolean().default(true),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductRecord = z.output<typeof productSchema> & { id: string };

export function productMatchesSearch(product: Pick<ProductRecord, "sku" | "productName" | "barcode" | "brand" | "category">, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [product.sku, product.productName, product.barcode, product.brand, product.category].some((value) => value?.toLowerCase().includes(needle));
}

export function productToAdvertSnapshot(product: ProductRecord) {
  return {
    productId: product.id,
    productName: product.productName,
    sku: product.sku,
    primarySpecification: product.primarySpecification,
    secondarySpecification: product.secondarySpecification,
    feature01: product.feature01,
    feature02: product.feature02,
    keyBenefit: product.keyBenefit,
    sellingPrice: String(product.currentPrice),
    qrUrl: product.websiteUrl || "https://www.toolhub.co.za",
    originalImageUrl: product.originalImageUrl,
    processedImageUrl: product.processedImageUrl,
    backgroundRemovalStatus: product.backgroundRemovalStatus,
    useOriginalImage: false,
  };
}
