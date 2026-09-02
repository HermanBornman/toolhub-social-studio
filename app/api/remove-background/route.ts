import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
const apiKey = process.env.REMOVE_BG_API_KEY;
if (!apiKey) {
return NextResponse.json({ error: "Remove.bg is not configured." }, { status: 503 });
}

const incoming = await request.formData();
const image = incoming.get("image");
if (!(image instanceof File) || !image.type.startsWith("image/")) {
return NextResponse.json({ error: "A valid product image is required." }, { status: 400 });
}
if (image.size > MAX_UPLOAD_BYTES) {
return NextResponse.json({ error: "The product image is too large." }, { status: 413 });
}

const formData = new FormData();
formData.append("image_file", image, image.name || "product.jpg");
formData.append("size", "auto");
formData.append("format", "png");

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 55_000);
try {
const response = await fetch(REMOVE_BG_ENDPOINT, {
method: "POST",
headers: { "X-Api-Key": apiKey },
body: formData,
signal: controller.signal,
cache: "no-store",
});
if (!response.ok) {
const retryAfter = response.headers.get("Retry-After");
return NextResponse.json(
{ error: response.status === 402 ? "Remove.bg credits are unavailable." : "Remove.bg could not process this image." },
{ status: response.status, headers: retryAfter ? { "Retry-After": retryAfter } : undefined },
);
}
return new NextResponse(await response.arrayBuffer(), {
status: 200,
headers: {
"Content-Type": response.headers.get("Content-Type") || "image/png",
"Cache-Control": "no-store",
"X-Background-Removal": "remove-bg",
},
});
} catch (error) {
const message = error instanceof Error && error.name === "AbortError"
? "Remove.bg timed out."
: "Remove.bg is temporarily unavailable.";
return NextResponse.json({ error: message }, { status: 502 });
} finally {
clearTimeout(timeout);
}
}
