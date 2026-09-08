export type PriceBasis = "list" | "nett" | "fivePlusOne" | "tenPlusThree";
export type ProductPrices = Partial<Record<PriceBasis, number>>;
export type ImageCrop = { x: number; y: number; width: number; height: number };
export type ConfidenceLevel = "high" | "medium" | "low";
export type ExtractionSource = "embedded-text" | "ocr" | "catalog-match" | "user" | "calculated";

export type ExtractedValue<T> = {
  value: T;
  confidence: ConfidenceLevel;
  source: ExtractionSource;
  note?: string;
};

export type ProductDetails = {
  title: string;
  brand?: string;
  category?: string;
  model: string;
  barcode: string;
  sku?: string;
  description: string;
  specs: string[];
  included?: string[];
  excluded?: string[];
  warranty?: string;
  warnings?: string[];
  prices: ProductPrices;
  imageCrop?: ImageCrop;
};

export type ProductAnalysis = {
  brand: ExtractedValue<string>;
  title: ExtractedValue<string>;
  category: ExtractedValue<string>;
  model: ExtractedValue<string>;
  sku: ExtractedValue<string>;
  barcode: ExtractedValue<string>;
  description: ExtractedValue<string>;
  specs: Array<ExtractedValue<string>>;
  included: Array<ExtractedValue<string>>;
  excluded: Array<ExtractedValue<string>>;
  warranty: ExtractedValue<string>;
  nettPrice: ExtractedValue<number | null>;
  promotionalPrice: ExtractedValue<number | null>;
  warnings: string[];
  possibleProductCount: number;
};

export type ImageCandidate = {
  id: string;
  dataUrl: string;
  source: "embedded-image" | "page-crop" | "uploaded-image";
  width: number;
  height: number;
  confidence: ConfidenceLevel;
  label: string;
};

export type TextBlock = { text: string; x: number; y: number; width: number; height: number };

export type SupplierPage = {
  dataUrl: string;
  page: number;
  width: number;
  height: number;
  embeddedText: string;
  textBlocks: TextBlock[];
  embeddedImages: ImageCandidate[];
};

export type PageDraftStatus = "analysing" | "needs-review" | "approved" | "generated" | "failed";

export type PageDraft = {
  id: string;
  sourceFilename: string;
  page: number;
  status: PageDraftStatus;
  pagePreview: string;
  rawEmbeddedText: string;
  rawOcrText: string;
  analysis: ProductAnalysis;
  imageCandidates: ImageCandidate[];
  selectedImageId: string;
  originalProductImage: string;
  cleanedProductImage: string;
  imageConfidence: ConfidenceLevel;
  sellingPrice: number | null;
  sellingPriceOverridden: boolean;
  markup: number;
  userCorrections: string[];
  acknowledgedWarnings: boolean;
  multiProductChoice?: "separate" | "combined";
  error?: string;
  createdAt: string;
  approvedAt?: string;
};

export type AdvertForm = {
  store: string;
  customStore: string;
  campaign: string;
  title: string;
  description: string;
  model: string;
  specs: string[];
  condition: string;
  price: string;
  saleEnabled: boolean;
  previousPrice: string;
  discountedPrice: string;
  startDate: string;
  endDate: string;
  stock: string;
  characterGender: "female" | "male";
  emotion: string;
  product: string;
};

export type GeneratedAdvert = {
  draftId?: string;
  page: number;
  product: ProductDetails;
  form: AdvertForm;
  advert: string;
  sellingPrice: number;
  auditId?: string;
};

export type AdvertAuditRecord = {
  id: string;
  sourceFilename: string;
  page: number;
  rawEmbeddedText: string;
  rawOcrText: string;
  confirmedProduct: ProductAnalysis;
  originalProductImage: string;
  cleanedProductImage: string;
  userCorrections: string[];
  pricing: {
    nettPrice: number | null;
    markup: number;
    calculatedSellingPrice: number | null;
    finalSellingPrice: number;
    overridden: boolean;
  };
  advertData: AdvertForm;
  finalAdvert: string;
  approvedAt: string;
};
