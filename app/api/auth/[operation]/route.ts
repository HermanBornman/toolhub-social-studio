import { NextResponse } from "next/server";
import { z } from "zod";
import { authService, sessionCookieName, sessionSecret, cookieOptions } from "@/lib/auth/server";
import { appOrigin, authBody, requireSameOrigin, throttle } from "@/lib/auth/http";
import { SESSION_SECONDS, RECOVERY_SECONDS } from "@/lib/auth/service";

export const runtime = "nodejs";
const emailSchema = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const passwordSchema = z.string().min(12).max(128);
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

// Intentionally public authentication endpoints, each POST is protected against CSRF.
// No signup operation; all redirects are fixed local paths.
export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  try {
    requireSameOrigin(request);
    if (operation === "logout") {
      await authService().logout(await sessionSecret());
      const response = reply({ ok: true });
      response.cookies.set(sessionCookieName(), "", cookieOptions(0));
      return response;
    }
    const body = await authBody(request);
    // A global ceiling bounds anonymous database/email work; Supabase adds native protection.
    await throttle("auth-global", "all", 200);
    if (operation === "login") {
      const input = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(body);
      await throttle("login", input.email);
      const session = await authService().login(input.email, input.password, await sessionSecret());
      const response = reply({ ok: true });
      response.cookies.set(sessionCookieName(), session.secret, cookieOptions(SESSION_SECONDS));
      return response;
    }
    if (operation === "forgot-password") {
      const email = emailSchema.parse(body.email);
      await throttle("reset", email, 3);
      await authService().requestReset(email, `${appOrigin()}/auth/confirm`);
      return reply({ message: "If an eligible account exists, a password reset email will arrive shortly." });
    }
    if (operation === "redeem") {
      const input = z.object({ tokenHash: z.string().regex(/^[a-f0-9]{40,128}$/i), type: z.enum(["recovery", "invite"]) }).parse(body);
      await throttle("redeem", "all", 50);
      const session = await authService().redeem(input.tokenHash, input.type, await sessionSecret());
      const response = reply({ ok: true });
      response.cookies.set(sessionCookieName(), session.secret, cookieOptions(RECOVERY_SECONDS));
      return response;
    }
    if (operation === "update-password") {
      const password = passwordSchema.parse(body.password);
      await authService().updatePassword(await sessionSecret(), password);
      const response = reply({ ok: true });
      response.cookies.set(sessionCookieName(), "", cookieOptions(0));
      return response;
    }
    return reply({ error: "Not found" }, 404);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "CSRF_REJECTED") return reply({ error: "Request not allowed" }, 403);
    if (reason === "RATE_LIMITED") return reply({ error: "Please try again later." }, 429);
    // Never reveal whether an account is absent, unlinked, disabled or has a wrong password.
    if (operation === "forgot-password") return reply({ message: "If an eligible account exists, a password reset email will arrive shortly." });
    return reply({ error: operation === "login" ? "Unable to sign in. Check your details or contact your administrator." : "Unable to complete this request. Please try again or request a new link." }, 401);
  }
}
