import { analyseProductText } from "./document-analysis";
import type { ImageCandidate, ProductDetails, SupplierPage, TextBlock } from "./types";

type PdfImage = {
  width?: number;
  height?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
};

type PdfPage = {
  getTextContent(): Promise<{ items: Array<Record<string, unknown>> }>;
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: Record<string, unknown>): { promise: Promise<unknown> };
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: { get(name: string, callback?: (value: PdfImage) => void): PdfImage | undefined };
};

function imageDataUrl(image: PdfImage) {
  const width = image.width || image.bitmap?.width || 0;
  const height = image.height || image.bitmap?.height || 0;
  if (!width || !height) return "";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return "";
  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0);
  } else if (image.data) {
    const source = image.data;
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (source.length === rgba.length) rgba.set(source);
    else if (source.length === width * height * 3) {
      for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 3, targetIndex += 4) {
        rgba[targetIndex] = source[sourceIndex];
        rgba[targetIndex + 1] = source[sourceIndex + 1];
        rgba[targetIndex + 2] = source[sourceIndex + 2];
        rgba[targetIndex + 3] = 255;
      }
    } else return "";
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else return "";
  return canvas.toDataURL("image/png");
}

async function objectFromPage(page: PdfPage, name: string) {
  return new Promise<PdfImage | undefined>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) resolve(undefined);
    }, 2500);
    page.objs.get(name, (value) => {
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    });
  });
}

async function extractEmbeddedImages(page: PdfPage, ops: Record<string, number>, pageNumber: number) {
  const operatorList = await page.getOperatorList();
  const paintOps = new Set([ops.paintImageXObject, ops.paintJpegXObject].filter(Number.isFinite));
  const names = operatorList.fnArray.flatMap((operation, index) => {
    if (!paintOps.has(operation)) return [];
    const name = operatorList.argsArray[index]?.[0];
    return typeof name === "string" ? [name] : [];
  });
  const uniqueNames = [...new Set(names)];
  const candidates: ImageCandidate[] = [];
  for (const [index, name] of uniqueNames.entries()) {
    const image = await objectFromPage(page, name);
    const width = image?.width || image?.bitmap?.width || 0;
    const height = image?.height || image?.bitmap?.height || 0;
    if (!image || width < 160 || height < 120) continue;
    const dataUrl = imageDataUrl(image);
    if (!dataUrl) continue;
    const area = width * height;
    const ratio = width / height;
    if (ratio > 8 || ratio < 0.12) continue;
    candidates.push({
      id: `page-${pageNumber}-embedded-${index}`,
      dataUrl,
      source: "embedded-image",
      width,
      height,
      confidence: area >= 500_000 ? "high" : area >= 120_000 ? "medium" : "low",
      label: `Embedded image ${index + 1} (${width} × ${height})`,
    });
  }
  return candidates.toSorted((a, b) => b.width * b.height - a.width * a.height).slice(0, 12);
}

function textFromPage(items: Array<Record<string, unknown>>) {
  const blocks: TextBlock[] = [];
  let previousY: number | undefined;
  const lines: string[] = [];
  for (const item of items) {
    const text = typeof item.str === "string" ? item.str.trim() : "";
    const transform = Array.isArray(item.transform) ? item.transform as number[] : [];
    if (!text || transform.length < 6) continue;
    const y = Number(transform[5]) || 0;
    if (previousY !== undefined && Math.abs(previousY - y) > 3) lines.push("\n");
    lines.push(text);
    previousY = y;
    blocks.push({
      text,
      x: Number(transform[4]) || 0,
      y,
      width: Number(item.width) || 0,
      height: Number(item.height) || Math.abs(Number(transform[3])) || 0,
    });
  }
  return { text: lines.join(" ").replace(/\s+\n\s+/g, "\n").trim(), blocks };
}

export function productFromOcr(text: string): ProductDetails {
  const analysis = analyseProductText("", text);
  return {
    brand: analysis.brand.value === "Not found" ? "" : analysis.brand.value,
    category: analysis.category.value === "Not found" ? "" : analysis.category.value,
    title: analysis.title.value === "Not found" ? "EXTRACTED PRODUCT" : analysis.title.value,
    model: analysis.model.value === "Not found" ? "" : analysis.model.value,
    sku: analysis.sku.value === "Not found" ? "" : analysis.sku.value,
    barcode: analysis.barcode.value === "Not found" ? "" : analysis.barcode.value,
    description: analysis.description.value === "Not found" ? "" : analysis.description.value,
    specs: analysis.specs.map((item) => item.value).slice(0, 4),
    included: analysis.included.map((item) => item.value),
    excluded: analysis.excluded.map((item) => item.value),
    warranty: analysis.warranty.value === "Not found" ? "" : analysis.warranty.value,
    warnings: analysis.warnings,
    prices: { nett: analysis.nettPrice.value || undefined },
  };
}

export async function renderSupplierFile(file: File, onStatus: (status: string) => void): Promise<SupplierPage[]> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs";
    const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: SupplierPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      onStatus(`Page ${pageNumber} of ${pdfDocument.numPages}: extracting embedded text and images...`);
      const page = await pdfDocument.getPage(pageNumber) as unknown as PdfPage;
      const [textContent, embeddedImages] = await Promise.all([
        page.getTextContent(),
        extractEmbeddedImages(page, pdfjs.OPS as unknown as Record<string, number>, pageNumber).catch(() => []),
      ]);
      const extracted = textFromPage(textContent.items);
      onStatus(`Page ${pageNumber} of ${pdfDocument.numPages}: creating high-resolution preview...`);
      const viewport = page.getViewport({ scale: 3.2 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error(`Page ${pageNumber}: preview canvas unavailable.`);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const pageRatio = canvas.width / canvas.height;
      const usableEmbeddedImages = embeddedImages.filter((candidate) => {
        const candidateRatio = candidate.width / candidate.height;
        const looksLikeFullPageScan = candidate.width * candidate.height > 500_000 && Math.abs(candidateRatio - pageRatio) < 0.035;
        return !looksLikeFullPageScan;
      });
      pages.push({
        dataUrl: canvas.toDataURL("image/png"),
        page: pageNumber,
        width: canvas.width,
        height: canvas.height,
        embeddedText: extracted.text,
        textBlocks: extracted.blocks,
        embeddedImages: usableEmbeddedImages,
      });
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
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const item = new Image();
      item.onload = () => resolve(item);
      item.onerror = reject;
      item.src = dataUrl;
    });
    return [{ dataUrl, page: 1, width: image.width, height: image.height, embeddedText: "", textBlocks: [], embeddedImages: [] }];
  }
  throw new Error("Please choose a PDF, JPG, PNG or WEBP file.");
}
