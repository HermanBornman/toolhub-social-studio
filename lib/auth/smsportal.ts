import "server-only";

type Fetcher = typeof fetch;

export async function sendSmsPortal(phoneE164: string, otp: string, fetcher: Fetcher = fetch) {
  const clientId = process.env.SMSPORTAL_CLIENT_ID;
  const apiSecret = process.env.SMSPORTAL_API_SECRET;
  if (!clientId || !apiSecret || !/^\+27\d{9}$/.test(phoneE164) || !/^\d{6}$/.test(otp)) throw new Error("SMS_DELIVERY_FAILED");
  const authorization = Buffer.from(`${clientId}:${apiSecret}`, "utf8").toString("base64");
  const response = await fetcher("https://rest.smsportal.com/v3/BulkMessages", {
    method: "POST",
    headers: { authorization: `Basic ${authorization}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ Messages: [{ Content: `Your Toolhub login code is ${otp}. It expires shortly. Do not share this code.`, Destination: phoneE164.slice(1) }] }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("SMS_DELIVERY_FAILED");
}
