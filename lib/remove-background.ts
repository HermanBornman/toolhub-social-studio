import { validateProductImageUpload } from "./product-image";

const PHOTOROOM_ENDPOINT = "https://sdk.photoroom.com/v1/segment";

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
  form.append("size", "full");
  form.append("format", "png");
  form.append("channels", "rgba");
  form.append("crop", "true");

  const response = await fetcher(PHOTOROOM_ENDPOINT, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, Accept: "image/png" },
    body: form,
  });

  if (!response.ok) {
    // Do not expose upstream response bodies, which may contain request details.
    if (response.status === 401 || response.status === 403) throw new Error("PhotoRoom rejected the API key — check its validity and API access");
    if (response.status === 402) throw new Error("PhotoRoom background removal quota exceeded — check your API credits");
    if (response.status === 429) throw new Error("PhotoRoom is busy — try again shortly");
    if (response.status === 400 || response.status === 422) throw new Error("PhotoRoom could not process this image — try another product crop");
    throw new Error(`PhotoRoom background removal service returned ${response.status}`);
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
  };
}
