export type PriceBasis = "list" | "nett" | "fivePlusOne" | "tenPlusThree";
export type ProductPrices = Partial<Record<PriceBasis, number>>;
export type ImageCrop = { x: number; y: number; width: number; height: number };

export type ProductDetails = {
title: string;
model: string;
barcode: string;
description: string;
specs: string[];
prices: ProductPrices;
imageCrop?: ImageCrop;
};

export type AdvertForm = {
store: string;
customStore: string;
campaign: string;
title: string;
description: string;
model: string;
specs: string[];
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

export type SupplierPage = { dataUrl: string; page: number };
export type GeneratedAdvert = {
page: number;
product: ProductDetails;
form: AdvertForm;
advert: string;
sellingPrice: number;
};
