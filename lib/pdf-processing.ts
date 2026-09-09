import { readVisibleText } from "./conservative-pdf-reader";
import type { ProductDetails, SupplierPage } from "./types";

function parsePrice(text: string, label: RegExp) {
const match = text.match(new RegExp(`${label.source}[\\s:=-]*R?\\s*([0-9][0-9\\s,.]{1,12})`, "i"));
if (!match?.[1]) return undefined;
const value = Number(match[1].replace(/\s/g, "").replace(/,(?=\d{2}\b)/, ".").replace(/[^\d.]/g, ""));
return Number.isFinite(value) ? value : undefined;
}

export function productFromOcr(text: string): ProductDetails {
const product = readVisibleText(text).products[0];
return {
title: product.title.value || "",
model: product.model.value || "",
barcode: text.match(/\b\d{12,14}\b/)?.[0] || "",
description: "",
specs: product.specs.map(spec => spec.value || ""),
condition: product.excluded.map(item => item.value).filter(Boolean).join(" · "),
prices: {
list: parsePrice(text, /LIST(?:\s+PRICE)?/),
nett: parsePrice(text, /NETT(?:\s+PRICE)?/),
fivePlusOne: parsePrice(text, /5\s*\+\s*1/),
tenPlusThree: parsePrice(text, /10\s*\+\s*3/),
},
};
}

export async function renderSupplierFile(file: File, onStatus: (status: string) => void): Promise<SupplierPage[]> {
if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
const pdfjs = await import("pdfjs-dist");
pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs";
const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
const pages: SupplierPage[] = [];
for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
onStatus(`Preparing page ${pageNumber} of ${document.numPages}...`);
const page = await document.getPage(pageNumber);
const content = await page.getTextContent();
const embeddedText = content.items.map(item => "str" in item ? item.str : "").join("\n");
const viewport = page.getViewport({ scale: 3.2 });
const canvas = window.document.createElement("canvas");
canvas.width = Math.round(viewport.width);
canvas.height = Math.round(viewport.height);
const context = canvas.getContext("2d", { alpha: false });
if (!context) continue;
await page.render({ canvas, canvasContext: context, viewport }).promise;
// Lossless source pages prevent JPEG softness before background removal.
pages.push({ dataUrl: canvas.toDataURL("image/png"), page: pageNumber, embeddedText });
}
return pages;
}
if (file.type.startsWith("image/")) {
const dataUrl = await new Promise<string>((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(String(reader.result));
reader.onerror = () => reject(reader.error);
reader.readAsDataURL(file);
});
return [{ dataUrl, page: 1 }];
}
throw new Error("Please choose a PDF, JPG, PNG or WEBP file.");
}

