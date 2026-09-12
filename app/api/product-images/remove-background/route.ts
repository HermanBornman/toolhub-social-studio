import { ensureCurrentUser } from "@/lib/server-user";
import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";
import { removeProductBackground } from "@/lib/remove-background";
import { canUseOriginalImage } from "@/lib/user-role";
import { validateProductImageUpload } from "@/lib/product-image";

export const runtime = "nodejs";
export const maxDuration = 60;

async function POSTHandler(request: Request) {
  const allowOriginalFallback = canUseOriginalImage((await ensureCurrentUser()).role);

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

    const apiKey = process.env.PHOTOROOM_API_KEY?.trim() || "";
    if (!apiKey) {
      return NextResponse.json({ error: "PhotoRoom background removal is not configured", canUseOriginal: allowOriginalFallback }, { status: 503 });
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

export const POST = withAuthorization("CREATE", POSTHandler);
