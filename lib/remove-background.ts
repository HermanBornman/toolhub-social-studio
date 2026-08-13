import { validateProductImageUpload } from "./product-image";

const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

type Fetcher = typeof fetch;

function pngDataUrl(bytes: ArrayBuffer) {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function removeProductBackground(file: File, apiKey: string, fetcher: Fetcher = fetch) {
  const validationError = validateProductImageUpload(file);
  if (validationError) throw new Error(validationError);
  if (!apiKey) throw new Error("Background removal is not configured");

  const form = new FormData();
  form.append("image_file", file, file.name || "product-image");
  form.append("size", "auto");
  form.append("type", "product");
  form.append("format", "png");
  form.append("crop", "true");
  form.append("crop_margin", "5%");
  form.append("semitransparency", "true");

  const response = await fetcher(REMOVE_BG_ENDPOINT, {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
  });

  if (!response.ok) {
    let detail = "";
    try { detail = (await response.text()).slice(0, 240); } catch { /* ignore unreadable service response */ }
    if (response.status === 402) throw new Error("Background removal quota exceeded");
    if (response.status === 429) throw new Error("Background removal is busy â€” try again shortly");
    throw new Error(detail || `Background removal service returned ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const pngBytes = new Uint8Array(bytes);
  const signature = pngBytes.slice(0, 8);
  const isPng = signature.length === 8 && signature.every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (!isPng) throw new Error("Background removal did not return a transparent PNG");
  const colorType = pngBytes[25];
  if (colorType !== 4 && colorType !== 6) throw new Error("Background removal PNG does not contain alpha transparency");

  return {
    processedImageUrl: pngDataUrl(bytes),
    creditsCharged: response.headers.get("x-credits-charged"),
  };
}
