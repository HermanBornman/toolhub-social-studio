import { readAsDataUrl } from "./image-processing";

// Send a high-resolution page to the image editor, never to a background-only remover.
export async function prepareSupplierImage(page: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const item = new Image(); item.onload = () => resolve(item); item.onerror = reject; item.src = page;
  });
  const ratio = Math.min(1, 2400 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot prepare product page.");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Cannot prepare image.")), "image/jpeg", 0.97));
  if (blob.size > 3 * 1024 * 1024) throw new Error("Page image exceeds 3 MB. Upload a smaller, clearer product image.");
  return blob;
}

export async function isolatePdfProduct(page: string, accessCode: string, identity = "") {
  const blob = await prepareSupplierImage(page);
  const body = new FormData(); body.append("image", blob, "supplier-page.jpg"); body.append("identity", identity);
  const response = await fetch("/api/isolate-product", { method: "POST", headers: { "x-toolhub-access-code": accessCode }, body, signal: AbortSignal.timeout(175_000) });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || "Product image could not be isolated.");
  }
  return readAsDataUrl(await response.blob());
}

export async function readSupplierPage(page: string, embeddedText: string, accessCode: string): Promise<import("./supplier-reading").SupplierReading> {
  const body = new FormData(); body.append("image", await prepareSupplierImage(page), "supplier-page.jpg"); body.append("embeddedText", embeddedText);
  const response = await fetch("/api/read-supplier", { method: "POST", headers: { "x-toolhub-access-code": accessCode }, body, signal: AbortSignal.timeout(70_000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not read supplier page.");
  return result;
}
