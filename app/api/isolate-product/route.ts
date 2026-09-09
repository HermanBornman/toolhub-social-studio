import { handleIsolation } from "@/lib/product-isolation-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  return handleIsolation(request, { apiKey: process.env.OPENAI_API_KEY, accessCode: process.env.TOOLHUB_IMAGE_ACCESS_CODE });
}
