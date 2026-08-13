import { NextResponse } from "next/server";
import { removeProductBackground } from "@/lib/remove-background";
import { canUseOriginalImage } from "@/lib/user-role";
import { validateProductImageUpload } from "@/lib/product-image";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const allowOriginalFallback = canUseOriginalImage();

  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Choose a product image", canUseOriginal: allowOriginalFallback }, { status: 400 });
    }

    const validationError = validateProductImageUpload(image);
    if (validationError) {
      return NextResponse.json({ error: validationError, canUseOriginal: allowOriginalFallback }, { status: 400 });
    }

    const apiKey = process.env.REMOVE_BG_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Background removal is not configured", canUseOriginal: allowOriginalFallback }, { status: 503 });
    }

    const result = await removeProductBackground(image, apiKey);
    return NextResponse.json({ ...result, status: "COMPLETE", canUseOriginal: allowOriginalFallback });
  } catch (error) {
    console.error("Background removal failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Background removal failed",
      canUseOriginal: allowOriginalFallback,
    }, { status: 502 });
  }
}

