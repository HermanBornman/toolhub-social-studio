"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, ImagePlus, Loader2, ScanText, ShieldCheck, UploadCloud } from "lucide-react";
import { calculateToolhubPrice, isSafeProductCrop, MULTI_PRODUCT_DECISIONS, normalizeTechnicalText, type ExtractedField, type PdfPageAnalysis, type SourceRegion } from "@/lib/pdf-import";

import { PowerInclusionReview } from "./PowerInclusionReview";
import { hydratePdfPage } from "@/lib/pdf-review-state";
import { ImportPricing } from "./ImportPricing";
import { defaultPricing, extractedPricing, type ExtractedPricing, type PricingInput } from "@/lib/import-pricing";

type ImportPage = {
  pricing?: PricingInput; extractedPricing?: ExtractedPricing;
  pageNumber: number; embeddedText: string; preview: string; analysis?: PdfPageAnalysis; analysisMethod?: string;
  selectedImageDataUrl: string; processedImageDataUrl: string; backgroundRemovalStatus: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  multiProductDecision?: (typeof MULTI_PRODUCT_DECISIONS)[number] | null; status: string; advertisementId?: string; error?: string;
};

const FIELD_LABELS: Array<[keyof Pick<PdfPageAnalysis,"brand"|"productName"|"category"|"model"|"sku"|"warranty"|"nettPrice"|"promotionalPrice">,string]> = [
  ["brand","Brand"],["productName","Product name"],["category","Category"],["model","Model"],["sku","Product code / SKU"],["warranty","Warranty"],["nettPrice","Nett price"],["promotionalPrice","Promotional / selling price"],
];

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/png";
  const bytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return new File([bytes], filename, { type: mime });
}

async function readFileDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Unable to read image")); reader.readAsDataURL(file); });
}

async function cropPage(preview: string, box: SourceRegion, excludedBadgeRegions: SourceRegion[] = []) {
  const image = new Image(); image.src = preview; await image.decode();
  const padding = 0.015;
  const x = Math.max(0, box.x - padding), y = Math.max(0, box.y - padding);
  const width = Math.min(1 - x, box.width + padding * 2), height = Math.min(1 - y, box.height + padding * 2);
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * width)); canvas.height = Math.max(1, Math.round(image.naturalHeight * height));
  canvas.getContext("2d")?.drawImage(image, image.naturalWidth * x, image.naturalHeight * y, image.naturalWidth * width, image.naturalHeight * height, 0, 0, canvas.width, canvas.height);
  const context = canvas.getContext("2d");
  // Erase separate supplier badges before sending the crop to PhotoRoom.
  for (const region of excludedBadgeRegions) context?.clearRect((region.x - x) / width * canvas.width, (region.y - y) / height * canvas.height, region.width / width * canvas.width, region.height / height * canvas.height);
  return canvas.toDataURL("image/png");
}

function ReviewField({ label, field, onChange }: { label: string; field: ExtractedField; onChange: (value: string) => void }) {
  return <label className="pdf-review-field"><span>{label}<i className={`confidence ${field.confidence.toLowerCase()}`}>{field.confidence}</i></span><input value={field.value} onChange={(event)=>onChange(normalizeTechnicalText(event.target.value))}/><small>{field.source.replaceAll("_"," ")} · page {field.sourcePage}</small></label>;
}

export function PdfImportWorkspace({ initialImportId = "" }: { initialImportId?: string }) {
  const [importId,setImportId]=useState(""); const [filename,setFilename]=useState(""); const [pages,setPages]=useState<ImportPage[]>([]);
  const [busy,setBusy]=useState(false); const [notice,setNotice]=useState("");

  useEffect(()=>{ if(!initialImportId)return; let cancelled=false;
    fetch(`/api/pdf-imports/${initialImportId}`).then(async response=>{if(!response.ok)throw new Error("Unable to load import");return response.json();}).then(data=>{if(cancelled)return;setImportId(data.id);setFilename(data.filename);setPages(data.pages.map((p:any)=>hydratePdfPage(p) as ImportPage));}).catch(error=>{if(!cancelled)setNotice(error.message);});return()=>{cancelled=true;};
  },[initialImportId]);

  const patchPage=(pageNumber:number, patch:Partial<ImportPage>)=>setPages(current=>current.map(page=>page.pageNumber===pageNumber?{...page,...patch}:page));

  const handlePdf=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0]; if(!file)return; event.target.value="";
    if(file.type!=="application/pdf"){setNotice("Choose a PDF file.");return;}
    setBusy(true);setNotice("Reading the PDF and rendering each page…");setFilename(file.name);setPages([]);setImportId("");
    try{
      const pdfjs=await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      const metadataResponse=await fetch("/api/pdf-imports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,mimeType:"application/pdf",size:file.size,pageCount:pdf.numPages})});
      const metadata=await metadataResponse.json(); if(!metadataResponse.ok)throw new Error(metadata.error||"Unable to create import"); setImportId(metadata.id);
      const rendered:ImportPage[]=[];
      for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
        try {
        const pdfPage=await pdf.getPage(pageNumber);const viewport=pdfPage.getViewport({scale:1.8});const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await pdfPage.render({canvasContext:canvas.getContext("2d")!,viewport}).promise;
        const textContent=await pdfPage.getTextContent();const embeddedText=textContent.items.map((item)=>"str" in item?item.str+("hasEOL" in item&&item.hasEOL?"\n":" "):"").join("");
        rendered.push({pageNumber,embeddedText,preview:canvas.toDataURL("image/jpeg",.92),selectedImageDataUrl:"",processedImageDataUrl:"",backgroundRemovalStatus:"PENDING",status:"PENDING_ANALYSIS"});
        } catch(error){rendered.push({pageNumber,embeddedText:"",preview:"",selectedImageDataUrl:"",processedImageDataUrl:"",backgroundRemovalStatus:"PENDING",status:"ANALYSIS_FAILED",error:"This page could not be rendered. Other pages remain available."});}
      }
      setPages(rendered);setNotice(`PDF read successfully. Analyzing ${rendered.length} page${rendered.length===1?"":"s"}…`);
      for(const page of rendered){
        if(page.status==="ANALYSIS_FAILED")continue;
        try {
        const response=await fetch(`/api/pdf-imports/${metadata.id}/pages/${page.pageNumber}/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeddedText:page.embeddedText,pagePreviewDataUrl:page.preview})});
        const result=await response.json();
        if(!response.ok)patchPage(page.pageNumber,{status:"ANALYSIS_FAILED",error:result.error||"Analysis failed"});
        else patchPage(page.pageNumber,{analysis:result.analysis,extractedPricing:JSON.parse(result.extractedPricingJson),pricing:defaultPricing(JSON.parse(result.extractedPricingJson)),analysisMethod:result.analysisMethod,status:"REVIEW_REQUIRED"});
        } catch(error){patchPage(page.pageNumber,{status:"ANALYSIS_FAILED",error:"Page analysis failed; other pages remain available."});}
      }
      setNotice("Analysis complete. Review every page before selecting an image or generating a draft.");
    }catch(error){setNotice(error instanceof Error?error.message:"PDF import failed");}finally{setBusy(false);}
  };

  const updateField=(pageNumber:number,key:keyof PdfPageAnalysis,value:string)=>setPages(current=>current.map(page=>{
    if(page.pageNumber!==pageNumber||!page.analysis)return page;
    return {...page,status:"REVIEW_REQUIRED",analysis:{...page.analysis,[key]:{...(page.analysis[key] as ExtractedField),value,confidence:"HIGH",source:"USER"}}};
  }));
  const updateList=(pageNumber:number,key:"technicalSpecifications"|"includedItems"|"excludedItems"|"warnings",value:string)=>setPages(current=>current.map(page=>{
    if(page.pageNumber!==pageNumber||!page.analysis)return page;
    return {...page,status:"REVIEW_REQUIRED",analysis:{...page.analysis,[key]:value.split("\n").map(item=>item.trim()).filter(Boolean).map(item=>({value:normalizeTechnicalText(item),confidence:"HIGH" as const,source:"USER" as const,sourcePage:pageNumber}))}};
  }));

  const processProduct=async(page:ImportPage,file?:File)=>{
    if(!page.analysis)return;
    patchPage(page.pageNumber,{status:"REVIEW_REQUIRED",backgroundRemovalStatus:"PROCESSING",processedImageDataUrl:"",error:undefined});
    try{
      let selected=file?await readFileDataUrl(file):"";
      if(!selected){if(!isSafeProductCrop(page.analysis.mainProductBoundingBox))throw new Error("Automatic product crop is uncertain. Upload a separate product image.");selected=await cropPage(page.preview,page.analysis.mainProductBoundingBox!,page.analysis.excludedBadgeRegions);file=dataUrlToFile(selected,`page-${page.pageNumber}-product.png`);}
      const form=new FormData();form.append("image",file!);const response=await fetch("/api/product-images/remove-background",{method:"POST",body:form});const result=await response.json();if(!response.ok||!result.processedImageUrl)throw new Error(result.error||"Background removal failed");
      patchPage(page.pageNumber,{selectedImageDataUrl:selected,processedImageDataUrl:result.processedImageUrl,backgroundRemovalStatus:"COMPLETE"});
    }catch(error){patchPage(page.pageNumber,{backgroundRemovalStatus:"FAILED",error:error instanceof Error?error.message:"Background removal failed"});}
  };

  const persist=async(page:ImportPage,action:"save"|"approve"|"createDraft")=>{
    if(!importId||!page.analysis&&action!=="createDraft")return;
    patchPage(page.pageNumber,{error:undefined});
    const body=action==="createDraft"?{action}:{action,pricing:page.pricing,analysis:page.analysis,selectedImageDataUrl:page.selectedImageDataUrl,processedImageDataUrl:page.processedImageDataUrl,backgroundRemovalStatus:page.backgroundRemovalStatus,multiProductDecision:page.multiProductDecision||null};
    const response=await fetch(`/api/pdf-imports/${importId}/pages/${page.pageNumber}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();
    if(!response.ok){patchPage(page.pageNumber,{error:Array.isArray(result.issues)?result.issues.join(" "):result.error||"Unable to save review"});return;}
    if(action==="createDraft")patchPage(page.pageNumber,{status:"DRAFT_CREATED",advertisementId:result.id});else patchPage(page.pageNumber,{status:action==="approve"?"REVIEW_APPROVED":"REVIEW_REQUIRED"});
  };

  return <div className="pdf-import-workspace">
    <section className="panel pdf-import-intro"><div><span className="section-kicker">CONTROLLED INGESTION</span><h2>PDF → analysis → review → advert</h2><p>One draft per page by default. Product imagery is processed only after page facts and layout have been classified.</p></div><label className="primary-button"><UploadCloud size={18}/>{busy?"Processing…":"Choose supplier PDF"}<input hidden type="file" accept="application/pdf" onChange={handlePdf} disabled={busy}/></label></section>
    {notice&&<div className="pdf-notice" role="status">{busy?<Loader2 className="spin" size={17}/>:<FileSearch size={17}/>}<span>{notice}</span></div>}
    {filename&&<div className="pdf-file-meta"><strong>{filename}</strong><span>{pages.length} page{pages.length===1?"":"s"} · original metadata retained · default: one advert per page</span></div>}
    <div className="pdf-pages">{pages.map(page=><section className="panel pdf-page-card" key={page.pageNumber}>
      <header><div><span>PAGE {page.pageNumber}</span><h3>{page.analysis?.productName.value||"Awaiting analysis"}</h3></div><i className={`page-state ${page.status.toLowerCase()}`}>{page.status.replaceAll("_"," ")}</i></header>
      <div className="pdf-review-grid"><div className="pdf-visuals"><figure><img src={page.preview} alt={`Supplier PDF page ${page.pageNumber}`}/><figcaption>PDF page preview</figcaption></figure><div className="selected-images"><figure>{page.selectedImageDataUrl?<img src={page.selectedImageDataUrl} alt="Selected original product"/>:<ImagePlus/>}<figcaption>Selected product</figcaption></figure><figure className="transparent-thumb">{page.processedImageDataUrl?<img src={page.processedImageDataUrl} alt="Background-removed product"/>:<ScanText/>}<figcaption>Transparent PNG</figcaption></figure></div>
        {page.analysis&&<div className="image-actions"><button className="secondary-button" type="button" disabled={page.backgroundRemovalStatus==="PROCESSING"} onClick={()=>void processProduct(page)}>{page.backgroundRemovalStatus==="PROCESSING"?<Loader2 className="spin" size={16}/>:<ScanText size={16}/>}Select detected product & remove background</button><label className="secondary-button"><ImagePlus size={16}/>Replace product image<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>{const file=event.target.files?.[0];event.target.value="";if(file)void processProduct(page,file);}}/></label></div>}
      </div><div className="pdf-review-fields">{page.analysis?<>
        <div className="analysis-method"><ShieldCheck size={16}/><span>{page.analysisMethod==="AI_VISION"?"Embedded text + OCR/visual layout analysis":"Embedded text fallback · manual visual review required"}</span></div>
        {FIELD_LABELS.filter(([key])=>key!=="nettPrice"&&key!=="promotionalPrice").map(([key,label])=><ReviewField key={key} label={label} field={page.analysis![key]} onChange={(value)=>updateField(page.pageNumber,key,value)}/>)}
        <label className="pdf-review-field"><span>Confirmed technical specifications</span><textarea rows={4} value={page.analysis.technicalSpecifications.map(item=>item.value).join("\n")} onChange={(event)=>updateList(page.pageNumber,"technicalSpecifications",event.target.value)}/></label>
        {page.analysis.sku.value === "Not found" && <label className="pricing-choice"><input type="checkbox" checked={!!page.analysis.skuNotFoundAcknowledged} onChange={e=>patchPage(page.pageNumber,{analysis:{...page.analysis!,skuNotFoundAcknowledged:e.target.checked},status:"REVIEW_REQUIRED"})}/>I acknowledge the SKU was not found; keep it unknown.</label>}
        <PowerInclusionReview value={page.analysis.powerInclusion} onChange={powerInclusion=>patchPage(page.pageNumber,{analysis:{...page.analysis!,powerInclusion},status:"REVIEW_REQUIRED"})}/>
        {page.analysis.detectedProducts?.map((product,index)=><details key={index} className="analysis-method"><summary>{product.name}</summary><pre style={{whiteSpace:"pre-wrap"}}>{product.sourceText}</pre></details>)}
        {page.analysis.productCount>1&&<label className="pdf-review-field multi-product"><span>Multiple products detected — choose handling</span><select value={page.multiProductDecision||""} onChange={(event)=>patchPage(page.pageNumber,{multiProductDecision:event.target.value as ImportPage["multiProductDecision"]})}><option value="">Confirmation required</option><option value="SEPARATE_ADVERTS">Create separate adverts</option><option value="COMBINED_ADVERT">Create one combined advert</option><option value="CHOOSE_ONE">Choose one product only</option><option value="MANUAL_REVIEW">Review manually</option></select></label>}
        <ImportPricing source={page.extractedPricing??extractedPricing(page.analysis)} value={page.pricing} onChange={pricing=>patchPage(page.pageNumber,{pricing,status:"REVIEW_REQUIRED"})}/>
        {[...page.analysis.analysisWarnings,...page.analysis.warnings.map(item=>item.value)].length>0&&<div className="confidence-warnings"><AlertTriangle size={17}/><ul>{[...page.analysis.analysisWarnings,...page.analysis.warnings.map(item=>item.value)].map((warning,index)=><li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
        {page.error&&<p className="pdf-error">{page.error}</p>}
        <div className="pdf-review-actions"><button className="secondary-button" type="button" onClick={()=>void persist(page,"save")}>Save corrections</button>{page.status!=="REVIEW_APPROVED"&&page.status!=="DRAFT_CREATED"&&<button className="primary-button" type="button" onClick={()=>void persist(page,"approve")}><CheckCircle2 size={16}/>Approve information</button>}{page.status==="REVIEW_APPROVED"&&<button className="primary-button" type="button" onClick={()=>void persist(page,"createDraft")}>Create draft advert</button>}{page.advertisementId&&<Link className="primary-button" href={`/adverts/${page.advertisementId}`}>Open draft advert</Link>}</div>
      </>:<div className="analysis-pending">{page.error?<><AlertTriangle/><p>{page.error}</p></>:<><Loader2 className="spin"/><p>Extracting text and classifying the page…</p></>}</div>}</div></div>
    </section>)}</div>
  </div>;
}
