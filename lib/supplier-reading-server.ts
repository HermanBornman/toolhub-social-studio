import { timingSafeEqual } from "node:crypto";
import { READING_PROMPT, READING_SCHEMA, validateReading } from "./supplier-reading.ts";
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
export async function handleReading(request: Request, config: { apiKey?: string; accessCode?: string }, transport: typeof fetch = fetch) {
  if (!config.apiKey || !config.accessCode) return fail("Supplier reading is not configured. Ask the administrator to connect the AI service.",503);
  const actual = Buffer.from(request.headers.get("x-toolhub-access-code") || ""); const expected = Buffer.from(config.accessCode);
  if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) return fail("Enter the staff AI-service access code.",401);
  if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024 + 65536) return fail("Page image is too large.",413);
  let form: FormData; try { form = await request.formData(); } catch { return fail("Invalid supplier page.",400); }
  const image = form.get("image");
  if (!(image instanceof File) || !["image/png","image/jpeg","image/webp"].includes(image.type) || !image.size || image.size > 3 * 1024 * 1024) return fail("A page image of up to 3 MB is required.",400);
  try {
    const response = await transport("https://api.openai.com/v1/responses", {
      method:"POST", headers:{ Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json" },
      signal:AbortSignal.any([request.signal,AbortSignal.timeout(65_000)]), cache:"no-store",
      body:JSON.stringify({ model:"gpt-4.1-2025-04-14",store:false,instructions:READING_PROMPT,
        input:[{role:"user",content:[{type:"input_text",text:`Read this supplier page. Supplementary embedded text:\n${String(form.get("embeddedText") || "").slice(0,20000)}`},
          {type:"input_image",image_url:`data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`,detail:"high"}]}],
        text:{format:{type:"json_schema",name:"supplier_page",strict:true,schema:READING_SCHEMA}},max_output_tokens:6500 }),
    });
    if (!response.ok) return fail("Supplier reading failed. Retry or enter the information manually.",502);
    const result = await response.json();
    if (result.status !== "completed") return fail("The page reading was incomplete. Try a clearer page.",502);
    const text = (result.output || []).flatMap((item: {content?: Array<{type:string;text?:string}>}) => item.content || []).filter((item: {type:string}) => item.type === "output_text").map((item:{text:string}) => item.text).join("");
    const reading = JSON.parse(text);
    if (!validateReading(reading)) return fail("The page could not be read reliably. Enter the information manually.",502);
    return Response.json(reading,{headers:{"Cache-Control":"no-store"}});
  } catch { return fail("Supplier reading timed out or returned incomplete data. Other page drafts are preserved.",504); }
}
