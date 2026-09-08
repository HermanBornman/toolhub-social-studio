import type { ConfidenceLevel, ImageCandidate, ImageCrop } from "./types";

export type IsolationOptions = { allowBasicFallback?: boolean; retainLargestSubject?: boolean };

export function readAsDataUrl(blob: Blob): Promise<string> {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(String(reader.result));
reader.onerror = () => reject(reader.error);
reader.readAsDataURL(blob);
});
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 1) {
return new Promise<Blob>((resolve, reject) => {
canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image conversion failed"))), type, quality);
});
}

function loadImage(source: string) {
return new Promise<HTMLImageElement>((resolve, reject) => {
const image = new Image();
image.onload = () => resolve(image);
image.onerror = reject;
image.src = source;
});
}

function normaliseCrop(crop: ImageCrop): ImageCrop {
const x = Math.max(0, Math.min(0.99, crop.x));
const y = Math.max(0, Math.min(0.99, crop.y));
return {
x,
y,
width: Math.max(0.01, Math.min(1 - x, crop.width)),
height: Math.max(0.01, Math.min(1 - y, crop.height)),
};
}

export function detectForegroundCrop(pixels: Uint8ClampedArray, width: number, height: number): ImageCrop {
if (width < 1 || height < 1 || pixels.length < width * height * 4) {
return { x: 0.03, y: 0.15, width: 0.94, height: 0.7 };
}
const mask = new Uint8Array(width * height);
for (let index = 0; index < width * height; index++) {
const offset = index * 4;
const red = pixels[offset];
const green = pixels[offset + 1];
const blue = pixels[offset + 2];
const darkest = Math.min(red, green, blue);
const lightest = Math.max(red, green, blue);
const saturation = lightest ? (lightest - darkest) / lightest : 0;
if (darkest < 226 || saturation > 0.13) mask[index] = 1;
}

const visited = new Uint8Array(mask.length);
const queue = new Int32Array(mask.length);
const minimumPixels = Math.max(18, Math.round(width * height * 0.00005));
const components: Array<{ pixels: number; left: number; top: number; right: number; bottom: number }> = [];
for (let start = 0; start < mask.length; start++) {
if (!mask[start] || visited[start]) continue;
let read = 0;
let write = 0;
let left = width;
let top = height;
let right = -1;
let bottom = -1;
visited[start] = 1;
queue[write++] = start;
while (read < write) {
const index = queue[read++];
const x = index % width;
const y = Math.floor(index / width);
left = Math.min(left, x);
top = Math.min(top, y);
right = Math.max(right, x);
bottom = Math.max(bottom, y);
for (let offsetY = -1; offsetY <= 1; offsetY++) {
for (let offsetX = -1; offsetX <= 1; offsetX++) {
if (!offsetX && !offsetY) continue;
const nextX = x + offsetX;
const nextY = y + offsetY;
if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
const next = nextY * width + nextX;
if (mask[next] && !visited[next]) {
visited[next] = 1;
queue[write++] = next;
}
}
}
}
if (write >= minimumPixels) components.push({ pixels: write, left, top, right, bottom });
}

const candidates = components.filter((component) => {
const componentWidth = component.right - component.left + 1;
const componentHeight = component.bottom - component.top + 1;
return componentWidth >= width * 0.12 && componentHeight >= height * 0.08;
});
const primary = candidates.sort((first, second) => {
const score = (component: typeof first) => {
const componentWidth = component.right - component.left + 1;
const componentHeight = component.bottom - component.top + 1;
const fill = component.pixels / (componentWidth * componentHeight);
const centreX = (component.left + component.right) / 2 / width;
const centreY = (component.top + component.bottom) / 2 / height;
const centrality = Math.max(0.45, 1 - Math.hypot(centreX - 0.55, centreY - 0.48) * 0.55);
const packagePenalty = fill > 0.72 && centreY > 0.58 ? 0.58 : 1;
return component.pixels * centrality * packagePenalty;
};
return score(second) - score(first);
})[0];
if (!primary) return { x: 0.03, y: 0.15, width: 0.94, height: 0.7 };

const componentWidth = primary.right - primary.left + 1;
const componentHeight = primary.bottom - primary.top + 1;
const padding = Math.max(10, Math.round(Math.max(componentWidth, componentHeight) * 0.065));
const left = Math.max(0, primary.left - padding);
const top = Math.max(0, primary.top - padding);
const right = Math.min(width - 1, primary.right + padding);
const bottom = Math.min(height - 1, primary.bottom + padding);
return normaliseCrop({
x: left / width,
y: top / height,
width: (right - left + 1) / width,
height: (bottom - top + 1) / height,
});
}

export function retainLargestAlphaComponent(pixels: Uint8ClampedArray, width: number, height: number, alphaThreshold = 18) {
const total = width * height;
if (width < 1 || height < 1 || pixels.length < total * 4) return 0;
const labels = new Int32Array(total);
const queue = new Int32Array(total);
const sizes = [0];
let label = 0;
for (let start = 0; start < total; start++) {
if (labels[start] || pixels[start * 4 + 3] <= alphaThreshold) continue;
label += 1;
let read = 0;
let write = 0;
labels[start] = label;
queue[write++] = start;
while (read < write) {
const index = queue[read++];
const x = index % width;
const y = Math.floor(index / width);
for (let offsetY = -1; offsetY <= 1; offsetY++) {
for (let offsetX = -1; offsetX <= 1; offsetX++) {
if (!offsetX && !offsetY) continue;
const nextX = x + offsetX;
const nextY = y + offsetY;
if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
const next = nextY * width + nextX;
if (!labels[next] && pixels[next * 4 + 3] > alphaThreshold) {
labels[next] = label;
queue[write++] = next;
}
}
}
}
sizes[label] = write;
}
let primaryLabel = 0;
for (let index = 1; index < sizes.length; index++) {
if (sizes[index] > (sizes[primaryLabel] || 0)) primaryLabel = index;
}
if (!primaryLabel || sizes[primaryLabel] <= total * 0.002) return 0;
for (let index = 0; index < total; index++) {
if (labels[index] !== primaryLabel) pixels[index * 4 + 3] = 0;
}
return sizes[primaryLabel];
}

export async function detectProductCrop(pageDataUrl: string): Promise<ImageCrop> {
const source = await loadImage(pageDataUrl);
const ratio = Math.min(1, 720 / Math.max(source.width, source.height));
const width = Math.max(1, Math.round(source.width * ratio));
const height = Math.max(1, Math.round(source.height * ratio));
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) return { x: 0.03, y: 0.15, width: 0.94, height: 0.7 };
context.drawImage(source, 0, 0, width, height);
return detectForegroundCrop(context.getImageData(0, 0, width, height).data, width, height);
}

export function normalizeCutoutAlpha(alpha: number) {
  return Math.max(0, Math.min(255, Math.round(alpha)));
}

async function floodFillBackground(file: Blob) {
const bitmap = await createImageBitmap(file);
const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
const width = Math.max(1, Math.round(bitmap.width * ratio));
const height = Math.max(1, Math.round(bitmap.height * ratio));
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) throw new Error("Canvas unavailable");
context.drawImage(bitmap, 0, 0, width, height);
bitmap.close();

const pixels = context.getImageData(0, 0, width, height);
const data = pixels.data;
const sample = Math.max(2, Math.round(Math.min(width, height) * 0.025));
const corners: number[][] = [];
for (const [left, top] of [[0, 0], [width - sample, 0], [0, height - sample], [width - sample, height - sample]]) {
let red = 0;
let green = 0;
let blue = 0;
let count = 0;
for (let y = top; y < top + sample; y += 2) {
for (let x = left; x < left + sample; x += 2) {
const offset = (y * width + x) * 4;
red += data[offset];
green += data[offset + 1];
blue += data[offset + 2];
count += 1;
}
}
corners.push([red / count, green / count, blue / count]);
}

const total = width * height;
const visited = new Uint8Array(total);
const queue = new Int32Array(total);
let read = 0;
let write = 0;
const enqueue = (index: number) => {
if (visited[index]) return;
const offset = index * 4;
const distance = Math.min(...corners.map(([r, g, b]) => Math.hypot(data[offset] - r, data[offset + 1] - g, data[offset + 2] - b)));
if (distance < 66) {
visited[index] = 1;
queue[write++] = index;
}
};
for (let x = 0; x < width; x++) {
enqueue(x);
enqueue((height - 1) * width + x);
}
for (let y = 1; y < height - 1; y++) {
enqueue(y * width);
enqueue(y * width + width - 1);
}
while (read < write) {
const index = queue[read++];
const x = index % width;
const y = Math.floor(index / width);
if (x > 0) enqueue(index - 1);
if (x < width - 1) enqueue(index + 1);
if (y > 0) enqueue(index - width);
if (y < height - 1) enqueue(index + width);
}
for (let index = 0; index < total; index++) {
if (visited[index]) data[index * 4 + 3] = 0;
}
context.putImageData(pixels, 0, 0);
return canvasToBlob(canvas);
}

async function enhanceAndTrimCutout(blob: Blob, retainLargestSubject = false) {
const image = await loadImage(await readAsDataUrl(blob));
const canvas = document.createElement("canvas");
canvas.width = image.width;
canvas.height = image.height;
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) return blob;
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = "high";
context.filter = "none";
context.drawImage(image, 0, 0);
context.filter = "none";

const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
if (retainLargestSubject) retainLargestAlphaComponent(pixels.data, canvas.width, canvas.height);
let left = canvas.width;
let top = canvas.height;
let right = -1;
let bottom = -1;
for (let index = 0; index < canvas.width * canvas.height; index++) {
const alphaIndex = index * 4 + 3;
const alpha = pixels.data[alphaIndex];
// Preserve fine anti-aliased edges, cables and soft shadows while making the solid product unfaded.
pixels.data[alphaIndex] = normalizeCutoutAlpha(alpha);
if (pixels.data[alphaIndex] > 0) {
const x = index % canvas.width;
const y = Math.floor(index / canvas.width);
left = Math.min(left, x);
top = Math.min(top, y);
right = Math.max(right, x);
bottom = Math.max(bottom, y);
}
}
context.putImageData(pixels, 0, 0);
if (right < left || bottom < top) return blob;

const padding = Math.max(12, Math.round(Math.max(right - left, bottom - top) * 0.04));
const sourceX = Math.max(0, left - padding);
const sourceY = Math.max(0, top - padding);
const sourceWidth = Math.min(canvas.width - sourceX, right - left + 1 + padding * 2);
const sourceHeight = Math.min(canvas.height - sourceY, bottom - top + 1 + padding * 2);
const trimmed = document.createElement("canvas");
trimmed.width = sourceWidth;
trimmed.height = sourceHeight;
const trimmedContext = trimmed.getContext("2d");
trimmedContext?.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
return canvasToBlob(trimmed);
}

async function removeBackgroundWithApi(file: File, onProgress: (progress: number) => void) {
const formData = new FormData();
formData.append("image", file, file.name);
onProgress(0.12);
const response = await fetch("/api/remove-background", { method: "POST", body: formData });
if (!response.ok) throw new Error(`Remove.bg returned ${response.status}`);
onProgress(0.9);
return response.blob();
}

export async function isolateProduct(
pageDataUrl: string,
crop: ImageCrop = { x: 0.02, y: 0.22, width: 0.64, height: 0.54 },
filename = "product",
onProgress: (progress: number) => void = () => undefined,
options: IsolationOptions = {},
) {
const source = await loadImage(pageDataUrl);
const sourceX = Math.max(0, Math.round(source.width * crop.x));
const sourceY = Math.max(0, Math.round(source.height * crop.y));
const sourceWidth = Math.min(source.width - sourceX, Math.round(source.width * crop.width));
const sourceHeight = Math.min(source.height - sourceY, Math.round(source.height * crop.height));
const cropCanvas = document.createElement("canvas");
cropCanvas.width = sourceWidth;
cropCanvas.height = sourceHeight;
const cropContext = cropCanvas.getContext("2d", { alpha: true });
if (!cropContext) throw new Error("Product extraction canvas unavailable");
cropContext.imageSmoothingEnabled = true;
cropContext.imageSmoothingQuality = "high";
cropContext.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
// Prefer lossless PNG so thin components and transparent or reflective edges survive.
// Fall back to near-lossless JPEG only when the server's safe upload limit requires it.
const losslessCrop = await canvasToBlob(cropCanvas, "image/png", 1);
const cropBlob = losslessCrop.size <= 7.5 * 1024 * 1024
  ? losslessCrop
  : await canvasToBlob(cropCanvas, "image/jpeg", 0.98);
const extension = cropBlob.type === "image/png" ? "png" : "jpg";
const file = new File([cropBlob], `${filename || "product"}.${extension}`, { type: cropBlob.type });

let removed: Blob;
try {
removed = await removeBackgroundWithApi(file, onProgress);
} catch {
try {
const { default: removeBackground } = await import("@imgly/background-removal");
removed = await removeBackground(file, {
publicPath: new URL("/api/bg-data/", window.location.href).toString(),
model: "medium",
proxyToWorker: false,
output: { format: "image/png", quality: 1 },
progress: (_key, current, total) => total > 0 && onProgress(Math.min(1, current / total)),
});
} catch {
if (options.allowBasicFallback === false) {
throw new Error("Professional background removal failed. Check remove.bg availability and try again.");
}
onProgress(0.75);
removed = await floodFillBackground(file);
}
}
return readAsDataUrl(await enhanceAndTrimCutout(removed, options.retainLargestSubject));
}

export async function isolateUploadedPhoto(file: File, onProgress: (progress: number) => void = () => undefined) {
return isolateProduct(await readAsDataUrl(file), { x: 0, y: 0, width: 1, height: 1 }, file.name.replace(/\.[^.]+$/, ""), onProgress);
}

export async function createPageCropCandidate(
  pageDataUrl: string,
  pageNumber: number,
  crop: ImageCrop = { x: 0.08, y: 0.2, width: 0.72, height: 0.58 },
  confidence: ConfidenceLevel = "low",
): Promise<ImageCandidate> {
  const source = await loadImage(pageDataUrl);
  const sourceX = Math.max(0, Math.round(source.width * crop.x));
  const sourceY = Math.max(0, Math.round(source.height * crop.y));
  const sourceWidth = Math.max(1, Math.min(source.width - sourceX, Math.round(source.width * crop.width)));
  const sourceHeight = Math.max(1, Math.min(source.height - sourceY, Math.round(source.height * crop.height)));
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Product crop canvas unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return {
    id: `page-${pageNumber}-suggested-crop`,
    dataUrl: canvas.toDataURL("image/png"),
    source: "page-crop",
    width: sourceWidth,
    height: sourceHeight,
    confidence,
    label: "Suggested product crop—review required",
  };
}

export async function removeCandidateBackground(
  candidate: ImageCandidate,
  filename: string,
  onProgress: (progress: number) => void = () => undefined,
) {
  const response = await fetch(candidate.dataUrl);
  const blob = await response.blob();
  const file = new File([blob], `${filename || "product"}.png`, { type: blob.type || "image/png" });
  return isolateProduct(
    await readAsDataUrl(file),
    { x: 0, y: 0, width: 1, height: 1 },
    filename,
    onProgress,
    { allowBasicFallback: false, retainLargestSubject: candidate.source === "page-crop" },
  );
}
