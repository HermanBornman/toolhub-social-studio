import { Webhook } from "https://esm.sh/standardwebhooks@1.1.1";

const SMS_PORTAL_URL = "https://rest.smsportal.com/v3/BulkMessages";
const OTP_PATTERN = /^\d{6}$/;
const E164_SA_PATTERN = /^\+27\d{9}$/;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function normalizeSouthAfricanMobile(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const normalized = compact.startsWith("0")
    ? `+27${compact.slice(1)}`
    : compact.startsWith("27")
      ? `+${compact}`
      : compact;

  if (!E164_SA_PATTERN.test(normalized)) throw new Error("INVALID_PHONE");
  return normalized;
}

function basicAuthorization(clientId: string, apiSecret: string) {
  return `Basic ${btoa(`${clientId}:${apiSecret}`)}`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
    const clientId = Deno.env.get("SMSPORTAL_CLIENT_ID");
    const apiSecret = Deno.env.get("SMSPORTAL_API_SECRET");
    if (!hookSecret || !clientId || !apiSecret) throw new Error("CONFIGURATION_MISSING");

    const body = await request.text();
    const signingKey = hookSecret.replace(/^v1,whsec_/, "");
    const verified = new Webhook(signingKey).verify(body, Object.fromEntries(request.headers));
    const payload = verified as {
      user?: { phone?: unknown };
      sms?: { otp?: unknown };
    };
    if (typeof payload.user?.phone !== "string" || typeof payload.sms?.otp !== "string" || !OTP_PATTERN.test(payload.sms.otp)) {
      throw new Error("INVALID_PAYLOAD");
    }

    const phone = normalizeSouthAfricanMobile(payload.user.phone);
    const providerResponse = await fetch(SMS_PORTAL_URL, {
      method: "POST",
      headers: {
        authorization: basicAuthorization(clientId, apiSecret),
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        Messages: [{
          Content: `Your Toolhub login code is ${payload.sms.otp}. It expires shortly. Do not share this code.`,
          Destination: phone.slice(1),
        }],
      }),
    });

    if (!providerResponse.ok) throw new Error("SMS_DELIVERY_FAILED");
    return jsonResponse({}, 200);
  } catch {
    // Never expose the OTP, phone number, signature, provider response, or credentials.
    return jsonResponse({ error: "Invalid or failed SMS hook request" }, 401);
  }
});
