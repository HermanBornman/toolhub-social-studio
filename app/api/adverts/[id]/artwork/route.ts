import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/server-user";
import { PNG_DATA_URL_PREFIX } from "@/lib/png";
import { withAuthorization } from "@/lib/route-authorization";

async function GETHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentUser();
  const id = (await params).id;
  const advert = await prisma.advertisement.findUnique({ where: { id } });
  if (!advert?.finalArtworkData) return NextResponse.json({ error: "Final artwork not found" }, { status: 404 });
  if (user.role !== "ADMIN" && advert.createdByUserId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bytes = Buffer.from(advert.finalArtworkData.slice(PNG_DATA_URL_PREFIX.length), "base64");
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(bytes, { headers: { "Content-Type": "image/png", "Content-Length": String(bytes.length), "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${advert.sku}-v${advert.finalVersion}.png"`, "Cache-Control": "private, no-store" } });
}

export const GET = withAuthorization("READ", GETHandler);
