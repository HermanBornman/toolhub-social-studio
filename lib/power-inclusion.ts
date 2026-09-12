import { z } from "zod";
const state = z.enum(["YES", "NO", "NOT_STATED"]);
export const powerInclusionSchema = z.object({
  batteryIncluded: state.default("NOT_STATED"), chargerIncluded: state.default("NOT_STATED"),
  batteryQuantity: z.number().int().min(1).max(100).nullable().default(null),
  batteryCapacity: z.string().max(40).default(""),
  accessoryCondition: z.enum(["STATED", "SOLD_SEPARATELY", "BARE_TOOL", "NOT_STATED", "UNCLEAR"]).default("NOT_STATED"),
  includedAccessories: z.array(z.string().max(120)).max(20).default([]), excludedAccessories: z.array(z.string().max(120)).max(20).default([]),
  inclusionConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("LOW"), inclusionSourceText: z.string().max(4000).default(""),
  inclusionSource: z.enum(["PDF", "USER", "NOT_STATED"]).default("NOT_STATED"),
  manuallyConfirmed: z.boolean().default(false), confirmedByUserId: z.string().nullable().default(null),
});
export type PowerInclusion = z.infer<typeof powerInclusionSchema>;
export const emptyPower = (): PowerInclusion => powerInclusionSchema.parse({});
export function detectPowerInclusion(text: string): PowerInclusion {
  const p = emptyPower();
  const lines = text.split(/[\n;]+/).map(s=>s.trim()).filter(s=>/\bbatter(?:y|ies)\b|\bcharger\b|\bbare tool\b/i.test(s));
  if (!lines.length) return p;
  p.inclusionSourceText=lines.join("\n").slice(0,4000); p.inclusionSource="PDF";
  const t=lines.join("; ").toLowerCase().replace(/\s+/g," ");
  const uncertain=/\b(?:may|might|optional|unclear|depending|possibly|compatible|compatibility)\b|\?/.test(t);
  if (uncertain) { p.accessoryCondition="UNCLEAR"; return p; }
  let contradiction=false;
  const set=(key:"batteryIncluded"|"chargerIncluded",v:"YES"|"NO")=>{if(p[key]!=="NOT_STATED"&&p[key]!==v)contradiction=true; p[key]=v;};
  for(const line of lines) {
    const s=line.toLowerCase();
    if(/\bbare tool(?: only)?\b/.test(s)){p.accessoryCondition="BARE_TOOL";set("batteryIncluded","NO");set("chargerIncluded","NO");continue;}
    const both=/batter(?:y|ies)\s*(?:and|&|\+)\s*charger/.test(s);
    if(both&&/sold separately|not included|excluded/.test(s)){set("batteryIncluded","NO");set("chargerIncluded","NO");if(/sold separately/.test(s))p.accessoryCondition="SOLD_SEPARATELY";continue;}
    if(both&&/included|supplied with|includes|comes with/.test(s)){set("batteryIncluded","YES");set("chargerIncluded","YES");continue;}
    const kit=s.match(/(?<![\d.])(\d+)\s*(?:[x×]\s*|\s+)(?:(\d+(?:\.\d+)?)\s*ah\s*)?batter(?:y|ies)\s*(?:and|&|\+)\s*charger/);
    if(kit){set("batteryIncluded","YES");set("chargerIncluded","YES");p.batteryQuantity=Number(kit[1]);p.batteryCapacity=kit[2]?kit[2]+"Ah":"";continue;}
    for(const [noun,key] of [["batter(?:y|ies)","batteryIncluded"],["charger","chargerIncluded"]] as const){
      if(new RegExp(noun+"\\s+(?:is |are )?(?:not included|excluded|sold separately)").test(s))set(key,"NO");
      else if(new RegExp(noun+"\\s+(?:is |are )?included|(?:includes?|supplied with)\\s+(?:a |one )?"+noun).test(s))set(key,"YES");
    }
  }
  if(contradiction){return {...emptyPower(),accessoryCondition:"UNCLEAR",inclusionSource:"PDF",inclusionSourceText:p.inclusionSourceText};}
  const qty=t.match(/(?<![\d.])(\d+)\s*(?:[x×]\s*|\s+)(?:(\d+(?:\.\d+)?)\s*ah\s*)?batter(?:y|ies)/);
  if(p.batteryIncluded==="YES"&&qty){p.batteryQuantity=Number(qty[1]);p.batteryCapacity=qty[2]?qty[2]+"Ah":"";}
  if(p.batteryIncluded==="YES"&&!p.batteryCapacity){const capacity=t.match(/(\d+(?:\.\d+)?)\s*ah\s*batter(?:y|ies)/);if(capacity)p.batteryCapacity=capacity[1]+"Ah";}
  if(p.batteryIncluded==="NOT_STATED"&&p.chargerIncluded==="NOT_STATED"){p.accessoryCondition="UNCLEAR";return p;}
  if(p.accessoryCondition==="NOT_STATED")p.accessoryCondition="STATED";
  p.inclusionConfidence="HIGH"; return p;
}
export function powerStatement(p?: PowerInclusion): string {
  if(!p || (!p.manuallyConfirmed && (p.inclusionSource!=="PDF" || p.inclusionConfidence!=="HIGH")) || ["UNCLEAR","NOT_STATED"].includes(p.accessoryCondition))return "";
  if(p.accessoryCondition==="BARE_TOOL")return "BARE TOOL ONLY";
  if(p.batteryIncluded==="NO"&&p.chargerIncluded==="NO")return p.accessoryCondition==="SOLD_SEPARATELY"?"BATTERY & CHARGER SOLD SEPARATELY":"BATTERY & CHARGER NOT INCLUDED";
  const battery=p.batteryQuantity?`${p.batteryQuantity}${p.batteryCapacity?` × ${p.batteryCapacity}`:""} ${p.batteryQuantity===1?"BATTERY":"BATTERIES"}`:`${p.batteryCapacity?p.batteryCapacity+" ":""}BATTERY`;
  if(p.batteryIncluded==="YES"&&p.chargerIncluded==="YES")return `${battery} + CHARGER INCLUDED`;
  const parts=[];
  if(p.batteryIncluded==="YES")parts.push(`${battery} INCLUDED`);
  if(p.batteryIncluded==="NO")parts.push("BATTERY NOT INCLUDED");
  if(p.chargerIncluded==="YES")parts.push("CHARGER INCLUDED");
  if(p.chargerIncluded==="NO")parts.push("CHARGER NOT INCLUDED");
  return parts.join(" · ");
}
export function readPower(value?:string):PowerInclusion {try{return powerInclusionSchema.parse(JSON.parse(value||"{}"));}catch{return emptyPower();}}
export function reviewPower(previous:PowerInclusion,submitted:PowerInclusion|undefined,userId:string):PowerInclusion {
  if(!submitted)return previous;
  const original={...previous,manuallyConfirmed:false,confirmedByUserId:null};
  const candidate={...submitted,manuallyConfirmed:false,confirmedByUserId:null};
  if(JSON.stringify(original)===JSON.stringify(candidate)&&!submitted.manuallyConfirmed)return previous;
  return {...submitted,inclusionSourceText:previous.inclusionSourceText,inclusionSource:"USER",inclusionConfidence:submitted.manuallyConfirmed?"HIGH":"LOW",confirmedByUserId:submitted.manuallyConfirmed?userId:null};
}
