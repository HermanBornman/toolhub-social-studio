import type { OcrLine, ProductDetails, SupplierPage } from "./types";

function parsePrice(text: string, label: RegExp) {
const match = text.match(new RegExp(`${label.source}[\\s:=-]*R?\\s*([0-9][0-9\\s,.]{1,12})`, "i"));
if (!match?.[1]) return undefined;
const value = Number(match[1].replace(/\s/g, "").replace(/,(?=\d{2}\b)/, ".").replace(/[^\d.]/g, ""));
return Number.isFinite(value) ? value : undefined;
}

export function productFromOcr(text: string, positionedLines: OcrLine[] = []): ProductDetails {
const orderedPositionedLines = [...positionedLines].sort((first, second) => (
first.bbox.y0 - second.bbox.y0 || first.bbox.x0 - second.bbox.x0
));
const rawLines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
const lines = [...new Set([...orderedPositionedLines.map((line) => line.text), ...rawLines])];
const modelMatch = text.match(/(?:MODEL|ITEM|CODE)\s*[:#-]?\s*([A-Z]{2,}[A-Z0-9-]{3,})/i)
|| text.match(/\b([A-Z]{2,}\d[A-Z0-9-]{4,})\b/);
const barcode = text.match(/\b\d{12,14}\b/)?.[0] || "";
const joined = `${text} ${orderedPositionedLines.map((line) => line.text).join(" ")}`.replace(/\s+/g, " ");
const directSpecs: string[] = [];
const addSpec = (value?: string) => {
if (value && !directSpecs.includes(value)) directSpecs.push(value);
};
const wood = joined.match(/WOOD\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*MM/i)?.[1];
const metal = joined.match(/METAL\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*MM/i)?.[1];
if (/BRUSHLESS|\bBL\s*MOTOR\b/i.test(joined)) addSpec("BRUSHLESS MOTOR");
if (wood) addSpec(`${wood.replace(",", ".")}MM WOOD CUTTING CAPACITY`);
if (metal) addSpec(`${metal.replace(",", ".")}MM METAL CUTTING CAPACITY`);
if (/BATTER(?:Y|IES)[\s\S]{0,80}(?:CHARGER[\s\S]{0,50})?SOLD\s+SEPARATELY/i.test(joined)) {
addSpec("BATTERY & CHARGER SOLD SEPARATELY");
}
if (/\bP20S\b/i.test(joined) && directSpecs.length < 4) addSpec("P20S BATTERY PLATFORM");

const genericSpecs = lines.filter((line) => (
/\d/.test(line)
&& line.length >= 5
&& line.length <= 54
&& !/PRICE|NETT|LIST|BARCODE|MODEL|ITEM|CODE|R\s?\d/i.test(line)
&& !/^P20S(?:\b|$)/i.test(line)
)).map((line) => line.toUpperCase());
const specs = [...new Set([...directSpecs, ...genericSpecs])].slice(0, 4);
const title = lines.find((line) => (
line.length > 8
&& line.length < 70
&& /[A-Z]/.test(line)
&& /SAW|DRILL|GRINDER|HAMMER|SANDER|SPRAYER|COMPRESSOR|GENERATOR|WRENCH|BLOWER|CUTTER|TOOL\s*(?:BAG|BOX|TOTE)/i.test(line)
&& !/PRICE|NETT|LIST|BARCODE|MODEL|WOOD|METAL|CAPACITY/i.test(line)
));
const candidateModel = modelMatch?.[1]?.toUpperCase() || "";
const model = /^P\d+S$/i.test(candidateModel) ? "" : candidateModel;
return {
title: (title || "PRODUCT NAME REQUIRED").toUpperCase(),
model,
barcode,
description: model ? `Model ${model} - details extracted from supplier artwork.` : "Review the extracted supplier information before finalising this advert.",
specs,
prices: {
list: parsePrice(text, /LIST(?:\s+PRICE)?/),
nett: parsePrice(text, /NETT(?:\s+PRICE)?/),
fivePlusOne: parsePrice(text, /5\s*\+\s*1/),
tenPlusThree: parsePrice(text, /10\s*\+\s*3/),
},
};
}

export function ocrLinesFromBlocks(blocks: Array<{ paragraphs?: Array<{ lines?: OcrLine[] }> }> | null | undefined) {
return (blocks || []).flatMap((block) => block.paragraphs || []).flatMap((paragraph) => paragraph.lines || [])
.map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
.filter((line) => line.text);
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
const viewport = page.getViewport({ scale: 3.2 });
const canvas = window.document.createElement("canvas");
canvas.width = Math.round(viewport.width);
canvas.height = Math.round(viewport.height);
const context = canvas.getContext("2d", { alpha: false });
if (!context) continue;
await page.render({ canvas, canvasContext: context, viewport }).promise;
// Lossless source pages prevent JPEG softness before background removal.
pages.push({ dataUrl: canvas.toDataURL("image/png"), page: pageNumber });
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
