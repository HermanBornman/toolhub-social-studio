// Conservative equivalence: exact normalized text, or a single wood/metal capacity.
// Other modifiers (speed, depth, range, blade length) are deliberately retained.
export function specificationKey(value: string): string {
  const text=value.normalize("NFKC").toLowerCase().replace(/(\d)\s*(mm|cm|ah|v|w|kg)\b/g,"$1 $2").replace(/[×]/g,"x").replace(/\s+/g," ").trim();
  const capacity=/^(?:(wood|metal)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mm|(\d+(?:\.\d+)?)\s*mm\s*(wood|metal)(?:\s+cutting\s+capacity)?)$/.exec(text);
  return capacity ? `capacity:${capacity[1]||capacity[4]}:${Number(capacity[2]||capacity[3])}:mm` : text;
}
export function uniqueSpecifications(values: string[]): string[] {
  const seen=new Set<string>();
  return values.map(x=>x.trim()).filter(value=>{const key=specificationKey(value);if(!key||seen.has(key))return false;seen.add(key);return true;});
}
export function uniqueExtractedFields<T extends {value:string;sourcePage:number}>(fields:T[]):T[] {
  const seen=new Set<string>();
  return fields.filter(field=>{const key=`${field.sourcePage}:${specificationKey(field.value)}`;if(seen.has(key))return false;seen.add(key);return true;});
}
export function dedupeSpecFields<T extends {primarySpecification:string;secondarySpecification?:string|null;feature01?:string|null;feature02?:string|null;keyBenefit?:string|null}>(data:T):T {
  const seen=new Set<string>();const result={...data};
  for(const field of ["primarySpecification","secondarySpecification","feature01","feature02","keyBenefit"] as const){
    const values=(data[field]||"").split(/\s*·\s*/).filter(value=>{const key=specificationKey(value);if(!key||seen.has(key))return false;seen.add(key);return true;});
    Object.assign(result,{[field]:values.join(" · ")});
  }
  return result;
}
