import { handleReading } from "@/lib/supplier-reading-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 75;
export async function POST(request: Request) {
  return handleReading(request, { apiKey: process.env.OPENAI_API_KEY, accessCode: process.env.TOOLHUB_IMAGE_ACCESS_CODE });
}
