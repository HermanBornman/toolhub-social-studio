import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { z } from "zod";
import { normalizeSouthAfricanMobile } from "@/lib/auth/phone";
import { sendSmsPortal } from "@/lib/auth/smsportal";

export const runtime = "nodejs";
const eventSchema = z.object({
  user: z.object({ phone: z.string() }).passthrough(),
  sms: z.object({ otp: z.string().regex(/^\d{6}$/) }).passthrough(),
}).passthrough();

export async function POST(request: Request) {
  try {
    const configured = process.env.SUPABASE_SEND_SMS_HOOK_SECRET;
    if (!configured) throw new Error("HOOK_CONFIGURATION_MISSING");
    const secret = configured.replace(/^v1,whsec_/, "");
    const payload = await request.text();
    const verified = new Webhook(secret).verify(payload, Object.fromEntries(request.headers));
    const event = eventSchema.parse(verified);
    const phone = normalizeSouthAfricanMobile(event.user.phone).mobileE164;
    await sendSmsPortal(phone, event.sms.otp);
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never echo the OTP, phone, hook signature, or provider response.
    return NextResponse.json({ error: { http_code: 500, message: "SMS delivery failed" } }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
