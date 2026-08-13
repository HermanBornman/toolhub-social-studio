"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, ImagePlus, Loader2, LockKeyhole, Save, Search, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { toPng } from "html-to-image";
import { AdvertPreview } from "./AdvertPreview";
import { MoodSelector } from "./MoodSelector";
import { advertSchema, CAMPAIGN_SUGGESTIONS, CAMPAIGN_TYPES, TEST_ADVERT, type AdvertFormData } from "@/lib/advert";
import { formatZar } from "@/lib/format-price";
import { validateProductImageUpload } from "@/lib/product-image";

type Errors = Partial<Record<keyof AdvertFormData | "form", string>>;

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <label className={`field ${error ? "has-error" : ""}`}><span>{label}</span>{children}{hint && !error && <small>{hint}</small>}{error && <small className="error-text">{error}</small>}</label>;
}

type SelectableProduct = { id:string; sku:string; barcode?:string|null; brand:string; productName:string; category:string; primarySpecification:string; secondarySpecification?:string|null; feature01?:string|null; feature02?:string|null; keyBenefit?:string|null; currentPrice:number; websiteUrl?:string|null; originalImageUrl:string; processedImageUrl?:string|null; backgroundRemovalStatus:AdvertFormData["backgroundRemovalStatus"] };

export function CreateAdvert({ initialData, initialId, initialStatus="DRAFT", approvalComment }: { initialData?: AdvertFormData; initialId?: string; initialStatus?: string; approvalComment?: string | null }) {
  const [data, setData] = useState<AdvertFormData>(initialData || TEST_ADVERT);
  const [draftId,setDraftId]=useState(initialId||""); const [status,setStatus]=useState(initialStatus);
  const [products,setProducts]=useState<SelectableProduct[]>([]); const [productQuery,setProductQuery]=useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [imageStatusText, setImageStatusText] = useState("Upload product image");
  const [canUseOriginal, setCanUseOriginal] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ fetch(`/api/products?q=${encodeURIComponent(productQuery)}`).then(r=>r.json()).then(value=>setProducts(Array.isArray(value)?value:[])); },[productQuery]);

  const selectProduct=(product:SelectableProduct)=>{ setData(current=>({...current,productId:product.id,productName:product.productName,sku:product.sku,primarySpecification:product.primarySpecification,secondarySpecification:product.secondarySpecification||"",feature01:product.feature01||"",feature02:product.feature02||"",keyBenefit:product.keyBenefit||"",sellingPrice:String(product.currentPrice),qrUrl:product.websiteUrl||"https://www.toolhub.co.za",originalImageUrl:product.originalImageUrl,processedImageUrl:product.processedImageUrl||"",backgroundRemovalStatus:product.backgroundRemovalStatus,useOriginalImage:false})); setImageStatusText(product.backgroundRemovalStatus==="COMPLETE"?"Saved transparent product image ready":"Product needs a transparent image"); setNotice(null); };

  const setField = <K extends keyof AdvertFormData>(field: K, value: AdvertFormData[K]) => {
    setData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setNotice(null);
  };

  const validate = () => {
    const parsed = advertSchema.safeParse(data);
    if (parsed.success) { setErrors({}); return true; }
    const next: Errors = {};
    for (const issue of parsed.error.issues) next[issue.path[0] as keyof AdvertFormData] ??= issue.message;
    setErrors(next);
    setNotice({ type: "error", text: "Please fix the highlighted fields before continuing." });
    return false;
  };

  const handleCampaign = (campaignType: AdvertFormData["campaignType"]) => {
    setData((current) => ({ ...current, campaignType, campaignMessage: CAMPAIGN_SUGGESTIONS[campaignType] }));
    setErrors((current) => ({ ...current, campaignType: undefined, campaignMessage: undefined }));
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateProductImageUpload(file);
    if (validationError) {
      setErrors((current) => ({ ...current, originalImageUrl: validationError }));
      setImageStatusText("Upload product image");
      return;
    }

    setErrors((current) => ({ ...current, originalImageUrl: undefined, form: undefined }));
    setNotice(null);
    setCanUseOriginal(false);
    setImageStatusText("Uploading...");

    const originalImageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read the selected image"));
      reader.readAsDataURL(file);
    });

    setData((current) => ({ ...current, originalImageUrl, processedImageUrl: "", backgroundRemovalStatus: "PROCESSING", useOriginalImage: false }));
    setImageStatusText("Removing background...");

    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/product-images/remove-background", { method: "POST", body: form });
      const result = await response.json();
      setCanUseOriginal(Boolean(result.canUseOriginal));
      if (!response.ok || !result.processedImageUrl) throw new Error(result.error || "Background removal failed");
      setData((current) => ({ ...current, processedImageUrl: result.processedImageUrl, backgroundRemovalStatus: "COMPLETE", useOriginalImage: false }));
      setImageStatusText("Product image ready");
    } catch {
      setData((current) => ({ ...current, processedImageUrl: "", backgroundRemovalStatus: "FAILED", useOriginalImage: false }));
      setImageStatusText("Background removal failed — use original image or upload another image");
      setNotice({ type: "error", text: "Background removal failed — use original image or upload another image" });
    } finally {
      event.target.value = "";
    }
  };

  const toggleOriginalImage = () => {
    setData((current) => ({ ...current, useOriginalImage: !current.useOriginalImage }));
    setImageStatusText(data.useOriginalImage ? "Product image ready" : "Using original image");
    setErrors((current) => ({ ...current, originalImageUrl: undefined, form: undefined }));
    setNotice(null);
  };

  const persistDraft = async () => {
    if (!validate()) return "";
    setSaving(true); setNotice(null);
    try {
      const response = await fetch(draftId?`/api/adverts/${draftId}`:"/api/adverts", { method: draftId?"PUT":"POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save draft");
      setDraftId(result.id); setNotice({ type: "success", text: `Draft saved · ${result.id.slice(0, 8).toUpperCase()}` }); return result.id as string;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save draft" });
      return "";
    } finally { setSaving(false); }
  };
  const saveDraft=()=>{void persistDraft();};
  const submitForApproval=async()=>{const id=await persistDraft();if(!id)return;setSaving(true);const response=await fetch(`/api/adverts/${id}/submit`,{method:"POST"});const result=await response.json();setSaving(false);if(!response.ok){setNotice({type:"error",text:result.error||"Unable to submit"});return;}setStatus(result.status);setNotice({type:"success",text:"Advert submitted for manager approval."});};

  const exportPng = async () => {
    if (!validate() || !canvasRef.current) return;
    setExporting(true); setNotice(null);
    try {
      await document.fonts.ready;
      const bounds = canvasRef.current.getBoundingClientRect();
      const dataUrl = await toPng(canvasRef.current, {
        width: bounds.width,
        height: bounds.height,
        canvasWidth: 1080,
        canvasHeight: 1350,
        pixelRatio: 1,
        cacheBust: true,
      });
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      if (image.naturalWidth !== 1080 || image.naturalHeight !== 1350) throw new Error(`Export was ${image.naturalWidth} × ${image.naturalHeight}, expected 1080 × 1350`);
      const link = document.createElement("a");
      link.download = `${data.sku || "toolhub-advert"}.png`;
      link.href = dataUrl;
      link.click();
      setNotice({ type: "success", text: "PNG exported at exactly 1080 × 1350 px." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "PNG export failed" });
    } finally { setExporting(false); }
  };

  return (
    <div className="creator-layout">
      <section className="form-panel">
        <div className="form-intro"><div className="step-badge">01</div><div><span className="section-kicker">ADVERT DETAILS</span><h2>Build your product advert</h2><p>Required fields are marked with an asterisk.</p></div></div>

        {approvalComment&&<div className="changes-banner"><strong>CHANGES REQUESTED</strong><span>{approvalComment}</span></div>}
        <div className="form-section product-picker">
          <div className="form-section-heading"><span>SELECT PRODUCT</span><small>Reuse stored specifications and transparent imagery.</small></div>
          <div className="picker-search"><Search size={17}/><input value={productQuery} onChange={e=>setProductQuery(e.target.value)} placeholder="Search SKU, product name or barcode"/><Link href="/products/new?returnToAdvert=true">+ Create New Product</Link></div>
          {productQuery&&<div className="picker-results">{products.slice(0,6).map(product=><button type="button" key={product.id} className={data.productId===product.id?"selected":""} onClick={()=>selectProduct(product)}><strong>{product.productName}</strong><span>{product.sku} · {product.brand}</span><small>{product.backgroundRemovalStatus==="COMPLETE"?"Transparent image ready":"Image processing required"}</small></button>)}</div>}
          {data.productId&&<div className="selected-product"><ShieldCheck size={17}/><span>Product selected · advert fields are now an independent snapshot.</span></div>}
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>PRODUCT</span><small>What are we selling?</small></div>
          <Field label="Product Name *" error={errors.productName}><input value={data.productName} maxLength={60} onChange={(e) => setField("productName", e.target.value)} /></Field>
          <div className="field-grid two">
            <Field label="Model / SKU *" error={errors.sku}><input value={data.sku} maxLength={32} onChange={(e) => setField("sku", e.target.value)} /></Field>
            <Field label="Primary Specification *" error={errors.primarySpecification}><input value={data.primarySpecification} maxLength={70} onChange={(e) => setField("primarySpecification", e.target.value)} /></Field>
          </div>
          <Field label="Secondary Specification" error={errors.secondarySpecification}><textarea rows={2} value={data.secondarySpecification} maxLength={110} onChange={(e) => setField("secondarySpecification", e.target.value)} /></Field>
          <div className="field-grid two">
            <Field label="Feature 01" error={errors.feature01}><input value={data.feature01} maxLength={28} onChange={(e) => setField("feature01", e.target.value)} /></Field>
            <Field label="Feature 02" error={errors.feature02}><input value={data.feature02} maxLength={28} onChange={(e) => setField("feature02", e.target.value)} /></Field>
          </div>
          <Field label="Key Product Benefit" error={errors.keyBenefit}><input value={data.keyBenefit} maxLength={42} onChange={(e) => setField("keyBenefit", e.target.value)} /></Field>
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>CAMPAIGN</span><small>Set the promotional message.</small></div>
          <div className="field-grid two">
            <Field label="Campaign Type *" error={errors.campaignType}><select value={data.campaignType} onChange={(e) => handleCampaign(e.target.value as AdvertFormData["campaignType"])}>{CAMPAIGN_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
            <Field label="Campaign Message *" error={errors.campaignMessage} hint="Suggested automatically; you can refine the wording."><input value={data.campaignMessage} maxLength={32} onChange={(e) => setField("campaignMessage", e.target.value.toUpperCase())} /></Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>PRICE & LINK</span><small>What should customers act on?</small></div>
          <div className="field-grid two">
            <Field label="Selling Price *" error={errors.sellingPrice} hint={`Preview: ${formatZar(data.sellingPrice)}`}><div className="price-input"><span>R</span><input inputMode="numeric" value={data.sellingPrice} onChange={(e) => setField("sellingPrice", e.target.value.replace(/\D/g, ""))} /></div></Field>
            <Field label="Disclaimer" error={errors.disclaimer}><input value={data.disclaimer} maxLength={50} onChange={(e) => setField("disclaimer", e.target.value.toUpperCase())} /></Field>
          </div>
          <Field label="QR URL *" error={errors.qrUrl} hint="A real scannable QR code is generated in the preview."><input type="url" value={data.qrUrl} onChange={(e) => setField("qrUrl", e.target.value)} /></Field>
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>PRODUCT IMAGE</span><small>Original proportions are preserved.</small></div>
          <label className={`upload-zone ${data.originalImageUrl ? "ready" : ""} ${errors.originalImageUrl ? "has-error" : ""}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} disabled={data.backgroundRemovalStatus === "PROCESSING"} />
            {data.originalImageUrl ? <><div className="upload-comparison"><figure><img src={data.originalImageUrl} alt="Original uploaded product" /><figcaption>Original upload</figcaption></figure>{data.processedImageUrl && <figure className="transparent-thumb"><img src={data.processedImageUrl} alt="Transparent processed product" /><figcaption>Transparent cut-out</figcaption></figure>}</div><div className="image-processing-copy"><strong>{imageStatusText}</strong><span>{data.backgroundRemovalStatus === "PROCESSING" ? "Keep this page open while the product is processed." : "Click to replace · PNG, JPG, WEBP"}</span></div>{data.backgroundRemovalStatus === "PROCESSING" ? <Loader2 className="spin" size={22} /> : <ImagePlus size={22} />}</> : <><div className="upload-icon"><UploadCloud size={25} /></div><div><strong>{imageStatusText} *</strong><span>PNG, JPG or WEBP · max 8 MB</span></div></>}
          </label>
          {canUseOriginal && data.originalImageUrl && data.backgroundRemovalStatus !== "PROCESSING" && <button className="image-fallback-button" type="button" onClick={toggleOriginalImage}>{data.useOriginalImage ? "Use transparent image" : "Use original image"}</button>}
          {errors.originalImageUrl && <p className="standalone-error">{errors.originalImageUrl}</p>}
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>MOOD</span><small>Choose one approved mascot expression.</small></div>
          <MoodSelector value={data.moodId} onChange={(mood) => setField("moodId", mood)} />
        </div>

        {notice && <div className={`notice ${notice.type}`} role="status">{notice.type === "success" ? <ShieldCheck size={17} /> : <span>!</span>}{notice.text}</div>}
        <div className="form-actions">
          <span className={`status-badge ${status.toLowerCase()}`}>{status.replaceAll("_"," ")}</span>
          <button className="secondary-button" type="button" onClick={saveDraft} disabled={saving || exporting || data.backgroundRemovalStatus === "PROCESSING" || status==="AWAITING_APPROVAL" || status==="APPROVED"}>{saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />} Save Draft</button>
          {(status==="DRAFT"||status==="CHANGES_REQUESTED")&&<button className="secondary-button submit-button" type="button" onClick={submitForApproval} disabled={saving||exporting||data.backgroundRemovalStatus!=="COMPLETE"}><Send size={18}/>{status==="CHANGES_REQUESTED"?"Resubmit for Approval":"Submit for Approval"}</button>}
          <button className="primary-button" type="button" onClick={exportPng} disabled={saving || exporting || data.backgroundRemovalStatus === "PROCESSING"}>{exporting ? <Loader2 className="spin" size={18} /> : <Download size={18} />} Export PNG</button>
        </div>
      </section>

      <aside className="preview-panel">
        <div className="preview-heading"><div><span className="section-kicker">LIVE PREVIEW</span><h2>1080 × 1350</h2></div><div className="locked-pill"><LockKeyhole size={13} /> Layout locked</div></div>
        <AdvertPreview data={data} canvasRef={canvasRef} />
        <div className="preview-note"><ShieldCheck size={18} /><p><strong>Brand-safe by default.</strong><br />Logos, mascot, price, QR, fonts, and colours stay in approved positions.</p></div>
      </aside>
    </div>
  );
}
