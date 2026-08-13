"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, LockKeyhole, Save, ShieldCheck, UploadCloud } from "lucide-react";
import { toPng } from "html-to-image";
import { AdvertPreview } from "./AdvertPreview";
import { MoodSelector } from "./MoodSelector";
import { advertSchema, CAMPAIGN_SUGGESTIONS, CAMPAIGN_TYPES, TEST_ADVERT, type AdvertFormData } from "@/lib/advert";
import { formatZar } from "@/lib/format-price";

type Errors = Partial<Record<keyof AdvertFormData | "form", string>>;

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <label className={`field ${error ? "has-error" : ""}`}><span>{label}</span>{children}{hint && !error && <small>{hint}</small>}{error && <small className="error-text">{error}</small>}</label>;
}

export function CreateAdvert() {
  const [data, setData] = useState<AdvertFormData>(TEST_ADVERT);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"] as string[]).includes(file.type)) {
      setErrors((current) => ({ ...current, productImage: "Use a PNG, JPG, or WEBP image" })); return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrors((current) => ({ ...current, productImage: "Image must be smaller than 8 MB" })); return;
    }
    const reader = new FileReader();
    reader.onload = () => setField("productImage", String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveDraft = async () => {
    if (!validate()) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/adverts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save draft");
      setNotice({ type: "success", text: `Draft saved · ${result.id.slice(0, 8).toUpperCase()}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save draft" });
    } finally { setSaving(false); }
  };

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
          <label className={`upload-zone ${data.productImage ? "ready" : ""} ${errors.productImage ? "has-error" : ""}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} />
            {data.productImage ? <><img src={data.productImage} alt="Product upload thumbnail" /><div><strong>Product image ready</strong><span>Click to replace · PNG, JPG, WEBP</span></div><ImagePlus size={22} /></> : <><div className="upload-icon"><UploadCloud size={25} /></div><div><strong>Upload product image *</strong><span>PNG, JPG or WEBP · max 8 MB</span></div></>}
          </label>
          {errors.productImage && <p className="standalone-error">{errors.productImage}</p>}
        </div>

        <div className="form-section">
          <div className="form-section-heading"><span>MOOD</span><small>Choose one approved mascot expression.</small></div>
          <MoodSelector value={data.moodId} onChange={(mood) => setField("moodId", mood)} />
        </div>

        {notice && <div className={`notice ${notice.type}`} role="status">{notice.type === "success" ? <ShieldCheck size={17} /> : <span>!</span>}{notice.text}</div>}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={saveDraft} disabled={saving || exporting}>{saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />} Save Draft</button>
          <button className="primary-button" type="button" onClick={exportPng} disabled={saving || exporting}>{exporting ? <Loader2 className="spin" size={18} /> : <Download size={18} />} Export PNG</button>
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