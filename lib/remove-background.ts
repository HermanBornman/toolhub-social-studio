import { validateSourceImage } from "./server-image";
import { validatePng } from "./png-transparency";
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

  await validateSourceImage(`data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`);
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
  if (response.headers.get("content-type")?.split(";")[0] !== "image/png") throw new Error("Background removal did not return a transparent PNG");
  try { validatePng(pngDataUrl(bytes),{transparent:true}); }
  catch { throw new Error("Background removal did not return a valid transparent PNG with alpha transparency"); }

  return {
    processedImageUrl: pngDataUrl(bytes),
  };
}
