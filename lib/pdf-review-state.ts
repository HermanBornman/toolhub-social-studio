import { pdfPageAnalysisSchema } from "./pdf-import";
import { defaultPricing, extractedPricing, pricingInputSchema } from "./import-pricing";
function parse(value: string | undefined) { try{return JSON.parse(value || "{}");}catch{return {};}}
export function hydratePdfPage(p:Record<string,any>) {
 const result=pdfPageAnalysisSchema.safeParse(parse(p.analysisJson));
 const base={...p,preview:p.pagePreviewDataUrl,embeddedText:p.rawExtractedText};
 if(!result.success)return {...base,analysis:undefined,error:"This page has no usable analysis. Other completed pages remain available; retry this page with a separate import."};
 const analysis=result.data,original=parse(p.extractedPricingJson);
 const source=original?.nettPrice?.value!==undefined&&original?.sellingPrice?.value!==undefined?original:extractedPricing(analysis);
 const pricing=pricingInputSchema.safeParse(parse(p.pricingJson));
 return {...base,analysis,extractedPricing:source,pricing:pricing.success&&p.pricingJson!=="{}"?pricing.data:defaultPricing(source)};
}
