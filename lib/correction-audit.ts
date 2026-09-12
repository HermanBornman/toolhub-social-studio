import { createHash } from "node:crypto";
// Full image bytes are retained in append-only image assets; audit snapshots reference them by hash.
export function auditSnapshot(value:unknown):unknown {
  if(typeof value === "string" && value.startsWith("data:image/")) return {imageSha256:createHash("sha256").update(value).digest("hex"),dataUrlLength:value.length};
  if(Array.isArray(value))return value.map(auditSnapshot);
  if(value instanceof Date)return value.toISOString();
  if(value && typeof value === "object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,auditSnapshot(item)]));
  return value;
}
export function correctionAudit(before:unknown,after:unknown,context:Record<string,unknown>={}) {
  return {version:1,recordedAt:new Date().toISOString(),...context,before:auditSnapshot(before),after:auditSnapshot(after)};
}

export function advertPricingAudit(advert:{pricingMethod:string;wasPrice:number|null;nowPrice:number|null;sellingPrice:number;pricingAuditJson:string}) {
  let original:Record<string,unknown>={};try{original=JSON.parse(advert.pricingAuditJson);}catch{}
  return {extracted:original.extracted ?? null,calculatedSellingPrice:original.calculatedSellingPrice ?? null,pricingMethod:advert.pricingMethod,wasPrice:advert.wasPrice,nowPrice:advert.nowPrice,manualFinalSellingPrice:advert.pricingMethod==="MANUAL"?advert.sellingPrice:null,finalSellingPrice:advert.sellingPrice,originalConfirmation:original};
}
