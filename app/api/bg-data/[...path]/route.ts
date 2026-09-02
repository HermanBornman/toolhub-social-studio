import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
const { path } = await params;
if (!path?.length || path.some((part) => part === ".." || !/^[a-zA-Z0-9._~-]+$/.test(part))) {
return NextResponse.json({ error: "Invalid background-removal asset path" }, { status: 400 });
}
const upstream = await fetch(new URL(path.join("/"), BASE_URL), { next: { revalidate: 60 * 60 * 24 * 30 } });
if (!upstream.ok) return new NextResponse("Model asset unavailable", { status: upstream.status });
const headers = new Headers();
headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
headers.set("cache-control", "public, max-age=31536000, immutable");
return new NextResponse(upstream.body, { status: 200, headers });
}
