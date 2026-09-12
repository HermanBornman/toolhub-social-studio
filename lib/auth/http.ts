import { createHmac } from "node:crypto";
import { prisma } from "../prisma";

export function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("UNAUTHENTICATED");
  const url = new URL(value);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("UNAUTHENTICATED");
  return url.origin;
}
export function requireSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  // Never derive the allowed origin from a caller-controlled Host header.
  if (!origin || origin !== appOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new Error("CSRF_REJECTED");
}
export async function authBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 8192) throw new Error("INVALID_USER_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_USER_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new Error("INVALID_USER_INPUT"); }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(text); } catch { throw new Error("INVALID_USER_INPUT"); }
}
export async function throttle(kind: string, identifier: string, limit = 10) {
  const key = process.env.AUTH_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("UNAUTHENTICATED");
  const now = new Date(), window = Math.floor(now.getTime() / 600_000);
  const id = createHmac("sha256", key).update(`${kind}:${identifier}:${window}`).digest("hex");
  // Atomic, database-backed; shared by processes. No client-supplied IP trust.
  await prisma.authThrottle.deleteMany({ where: { expiresAt: { lte: now } } });
  const row = await prisma.authThrottle.upsert({ where: { id }, create: { id, expiresAt: new Date((window + 1) * 600_000) }, update: { attempts: { increment: 1 } } });
  if (row.attempts > limit) throw new Error("RATE_LIMITED");
}
