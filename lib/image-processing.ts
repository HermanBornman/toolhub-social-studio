import type { ImageCrop } from "./types";

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

async function enhanceAndTrimCutout(blob: Blob) {
const image = await loadImage(await readAsDataUrl(blob));
const canvas = document.createElement("canvas");
canvas.width = image.width;
canvas.height = image.height;
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) return blob;
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = "high";
context.filter = "brightness(1.035) contrast(1.14) saturate(1.18)";
context.drawImage(image, 0, 0);
context.filter = "none";

const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
let left = canvas.width;
let top = canvas.height;
let right = -1;
let bottom = -1;
for (let index = 0; index < canvas.width * canvas.height; index++) {
const alphaIndex = index * 4 + 3;
const alpha = pixels.data[alphaIndex];
// Preserve an opaque, unfaded product while retaining a short anti-aliased edge.
pixels.data[alphaIndex] = alpha <= 26 ? 0 : alpha >= 112 ? 255 : Math.round(((alpha - 26) / 86) * 255);
if (pixels.data[alphaIndex] > 18) {
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
// A near-lossless JPEG keeps the server upload well below platform limits while
// preserving the high-resolution source pixels used by remove.bg.
const cropBlob = await canvasToBlob(cropCanvas, "image/jpeg", 0.97);
const file = new File([cropBlob], `${filename || "product"}.jpg`, { type: "image/jpeg" });

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
onProgress(0.75);
removed = await floodFillBackground(file);
}
}
return readAsDataUrl(await enhanceAndTrimCutout(removed));
}

export async function isolateUploadedPhoto(file: File, onProgress: (progress: number) => void = () => undefined) {
return isolateProduct(await readAsDataUrl(file), { x: 0, y: 0, width: 1, height: 1 }, file.name.replace(/\.[^.]+$/, ""), onProgress);
}
