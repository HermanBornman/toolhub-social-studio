import { formatPrice } from "./pricing";
import { fitProductBox } from "./fit-product";
import type { AdvertForm } from "./types";

const ORANGE = "#ff7900";

function loadImage(source: string) {
return new Promise<HTMLImageElement>((resolve, reject) => {
const image = new Image();
image.onload = () => resolve(image);
image.onerror = reject;
image.src = source;
});
}

function contain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
const scale = Math.min(width / image.width, height / image.height);
const drawWidth = image.width * scale;
const drawHeight = image.height * scale;
context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines = 2) {
const words = value.trim().split(/\s+/);
const lines: string[] = [];
let line = "";
for (const word of words) {
const candidate = line ? `${line} ${word}` : word;
if (!line || context.measureText(candidate).width <= maxWidth) line = candidate;
else {
lines.push(line);
line = word;
if (lines.length === maxLines - 1) break;
}
}
if (line && lines.length < maxLines) lines.push(line);
return lines;
}

function formatDate(value: string) {
if (!value) return "";
const [year, month, day] = value.split("-").map(Number);
return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
.format(new Date(year, month - 1, day))
.toUpperCase();
}

function opaqueBounds(image: HTMLImageElement) {
const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
const canvas = document.createElement("canvas");
canvas.width = Math.max(1, Math.round(image.width * scale));
canvas.height = Math.max(1, Math.round(image.height * scale));
const context = canvas.getContext("2d", { willReadFrequently: true });
if (!context) return { x: 0, y: 0, width: image.width, height: image.height };
context.drawImage(image, 0, 0, canvas.width, canvas.height);
const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
let left = canvas.width;
let top = canvas.height;
let right = -1;
let bottom = -1;
for (let y = 0; y < canvas.height; y++) {
for (let x = 0; x < canvas.width; x++) {
if (data[(y * canvas.width + x) * 4 + 3] > 52) {
left = Math.min(left, x);
top = Math.min(top, y);
right = Math.max(right, x);
bottom = Math.max(bottom, y);
}
}
}
if (right < left || bottom < top) return { x: 0, y: 0, width: image.width, height: image.height };
return {
x: left / scale,
y: top / scale,
width: (right - left + 1) / scale,
height: (bottom - top + 1) / scale,
};
}

function drawProductHero(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
const bounds = opaqueBounds(image);
const padding = 8;
const fitted = fitProductBox(bounds.width, bounds.height, width - padding * 2, height - padding * 2);
const drawX = x + (width - fitted.width) / 2;
const drawY = y + (height - fitted.height) / 2;
context.save();
context.shadowColor = "rgba(255,121,0,.34)";
context.shadowBlur = 28;
context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, drawX, drawY, fitted.width, fitted.height);
context.restore();
}

export async function renderAdvert(canvas: HTMLCanvasElement, form: AdvertForm, storeName: string, storeAddress = "") {
const context = canvas.getContext("2d");
if (!context) throw new Error("Advert canvas unavailable");
canvas.width = 1080;
canvas.height = 1350;
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = "high";

const [brand, mascot, product, qr] = await Promise.all([
loadImage("/toolhub/brand-lockup.png"),
loadImage(form.characterGender === "male" ? `/toolhub/character-male-${form.emotion}.png` : `/toolhub/mascot-${form.emotion}.png`),
loadImage(form.product),
loadImage("/toolhub/shop-qr.png"),
]);

const background = context.createLinearGradient(0, 0, 1080, 1350);
background.addColorStop(0, "#060708");
background.addColorStop(0.62, "#0a0b0c");
background.addColorStop(1, "#020303");
context.fillStyle = background;
context.fillRect(0, 0, 1080, 1350);
context.save();
context.globalAlpha = 0.055;
context.strokeStyle = "#fff";
for (let x = 0; x < 1080; x += 36) {
context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 1350); context.stroke();
}
for (let y = 0; y < 1350; y += 36) {
context.beginPath(); context.moveTo(0, y); context.lineTo(1080, y); context.stroke();
}
context.restore();

// Slightly smaller brand header frees meaningful vertical space for the product.
contain(context, brand, 90, 20, 900, 244);
context.strokeStyle = "#838589";
context.lineWidth = 2;
context.beginPath(); context.moveTo(72, 282); context.lineTo(1008, 282); context.stroke();
context.fillStyle = "#fff";
context.font = "700 23px Arial";
context.textAlign = "center";
context.fillText(storeName.toUpperCase(), 540, 332, 936);
if (storeAddress) {
context.fillStyle = "#c7c9cb";
context.font = "600 16px Arial";
context.fillText(storeAddress.toUpperCase(), 540, 358, 936);
}
context.textAlign = "left";

context.fillStyle = "#f7f7f7";
context.font = "900 66px Impact, Arial Black, Arial";
const titleLines = wrapText(context, form.title.toUpperCase(), 936, 2);
titleLines.forEach((line, index) => context.fillText(line, 72, 412 + index * 70));
const descriptionTop = titleLines.length === 1 ? 466 : 536;
context.fillStyle = "#c7c9cb";
context.font = "500 23px Arial";
const descriptionLines = wrapText(context, form.description, 850, 2);
descriptionLines.forEach((line, index) => context.fillText(line, 74, descriptionTop + index * 29));
const dividerY = descriptionTop + descriptionLines.length * 29 + 18;
context.fillStyle = ORANGE;
context.fillRect(72, dividerY, 936, 14);

const specsTop = dividerY + 34;
form.specs.forEach((spec, index) => {
context.fillStyle = index === 0 ? "#fff" : "#dedede";
context.font = "700 18px Arial";
wrapText(context, spec.toUpperCase(), 238, 2).forEach((line, lineIndex) => {
context.fillText(line, 88, specsTop + 34 + index * 59 + lineIndex * 18);
});
});

// A deeper 660 x up-to-390 hero area gives the product roughly 35-40% more visual weight.
drawProductHero(context, product, 348, dividerY + 18, 660, Math.max(300, 1024 - (dividerY + 18)));

const footer = context.createLinearGradient(0, 980, 0, 1220);
footer.addColorStop(0, "#252729");
footer.addColorStop(1, "#070808");
context.fillStyle = footer;
context.beginPath();
context.moveTo(0, 1080); context.lineTo(1080, 1015); context.lineTo(1080, 1175); context.lineTo(0, 1240); context.closePath(); context.fill();
context.save();
if (form.characterGender === "female") context.globalCompositeOperation = "screen";
contain(context, mascot, 20, 1000, 320, 310);
context.restore();

// Keep the previously approved 25% smaller price and QR treatment.
const priceTop = form.saleEnabled ? 1062 : 1080;
context.fillStyle = ORANGE;
context.font = "700 21px Arial";
context.textAlign = "center";
context.fillText(form.campaign.toUpperCase(), 548, priceTop - 18, 320);
context.fillStyle = ORANGE;
context.fillRect(420, priceTop, 255, form.saleEnabled ? 119 : 101);
context.fillStyle = "#050505";
if (form.saleEnabled) {
const previousPrice = `WAS ${formatPrice(form.previousPrice || form.price)}`;
context.font = "800 21px Arial";
context.fillText(previousPrice, 548, 1094);
const previousWidth = context.measureText(previousPrice).width;
context.strokeStyle = "#050505";
context.lineWidth = 3;
context.beginPath();
context.moveTo(548 - previousWidth / 2, 1087);
context.lineTo(548 + previousWidth / 2, 1087);
context.stroke();
context.font = "900 52px Impact, Arial Black, Arial";
context.fillText(formatPrice(form.discountedPrice || form.price), 548, 1162);
} else {
context.font = "900 56px Impact, Arial Black, Arial";
context.fillText(formatPrice(form.price), 548, 1150);
}
const dates = form.endDate && form.endDate !== form.startDate
? `${formatDate(form.startDate)} - ${formatDate(form.endDate)}`
: formatDate(form.startDate);
context.fillStyle = "#fff";
context.font = "700 19px Arial";
context.fillText(dates, 548, 1218);
context.fillStyle = "#d7d7d7";
context.font = "500 17px Arial";
context.fillText(form.stock.toUpperCase(), 548, 1250);

context.fillStyle = "#fff";
context.fillRect(827, 1060, 155, 155);
context.drawImage(qr, 835, 1068, 139, 139);
context.fillStyle = ORANGE;
context.font = "800 18px Arial";
context.fillText("SCAN TO SHOP", 905, 1248);
context.fillStyle = "#fff";
context.font = "700 15px Arial";
context.fillText("www.toolhub.co.za", 905, 1275);
context.textAlign = "left";
context.fillStyle = ORANGE;
context.fillRect(72, 1322, 936, 3);
}
