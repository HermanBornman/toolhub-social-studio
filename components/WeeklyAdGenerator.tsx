"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { renderAdvert } from "@/lib/advert-renderer";
import { findCatalogProduct } from "@/lib/catalog";
import { isolateProduct, isolateUploadedPhoto } from "@/lib/image-processing";
import { productFromOcr, renderSupplierFile } from "@/lib/pdf-processing";
import { calculateSellingPrice, formatPrice } from "@/lib/pricing";
import type { AdvertForm, GeneratedAdvert, PriceBasis, ProductDetails, SupplierPage } from "@/lib/types";

const STORES = [
{ name: "Toolhub Polokwane Crossing", address: "" },
{ name: "Toolhub Stonewood", address: "33 Tanzanite Cres" },
{ name: "Toolhub Yzerfontein", address: "29 Buitekant St" },
{ name: "Toolhub Online", address: "" },
{ name: "All Toolhub Stores", address: "" },
{ name: "Custom store...", address: "" },
];
const CHARACTER_OPTIONS: Record<AdvertForm["characterGender"], Array<{ id: string; label: string }>> = {
female: [
{ id: "friendly", label: "Friendly" },
{ id: "excited", label: "Excited" },
{ id: "surprised", label: "Surprised" },
{ id: "confident", label: "Confident" },
{ id: "thoughtful", label: "Thoughtful" },
{ id: "focused", label: "Focused" },
],
male: [
{ id: "laugh", label: "Laugh" },
{ id: "smile", label: "Smile" },
{ id: "thumbs-up", label: "Thumbs Up" },
{ id: "wink", label: "Wink" },
{ id: "wonder", label: "Wonder" },
{ id: "wow", label: "WOW" },
],
};

function characterAsset(gender: AdvertForm["characterGender"], emotion: string) {
return gender === "male" ? `/toolhub/character-male-${emotion}.png` : `/toolhub/mascot-${emotion}.png`;
}

type OcrWorker = {
recognize(image: string): Promise<{ data: { text: string } }>;
setParameters(parameters: Record<string, string>): Promise<unknown>;
terminate(): Promise<unknown>;
};

const INITIAL_FORM: AdvertForm = {
store: STORES[0].name,
customStore: "",
campaign: "WEEKLY SPECIAL",
title: "VARIABLE SPEED FLOOR FAN",
description: "Heavy-duty portable cooling for workshops and work sites.",
model: "",
specs: ["VARIABLE SPEED CONTROL", "LOW - MID - HIGH", "STABLE FLOOR STAND", "BUILT FOR WORK SITES"],
price: "1200",
saleEnabled: false,
previousPrice: "",
discountedPrice: "",
startDate: "2026-08-31",
endDate: "2026-09-05",
stock: "WHILE STOCKS LAST",
characterGender: "female",
emotion: "confident",
product: "/toolhub/sample-product.webp",
};

function storeDetails(form: AdvertForm) {
if (form.store === "Custom store...") return { name: form.customStore || "YOUR STORE NAME", address: "" };
return STORES.find((store) => store.name === form.store) || { name: form.store, address: "" };
}

function downloadDataUrl(dataUrl: string, filename: string) {
const anchor = document.createElement("a");
anchor.download = filename;
anchor.href = dataUrl;
anchor.click();
}

function slug(value: string) {
return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
return <label className="field"><span>{label}</span>{children}</label>;
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
return <div className="section-heading"><span aria-hidden="true">{icon}</span><strong>{children}</strong></div>;
}

export default function WeeklyAdGenerator() {
const canvasRef = useRef<HTMLCanvasElement>(null);
const supplierInputRef = useRef<HTMLInputElement>(null);
const photoInputRef = useRef<HTMLInputElement>(null);
const cameraInputRef = useRef<HTMLInputElement>(null);
const [form, setForm] = useState<AdvertForm>(INITIAL_FORM);
const [previewReady, setPreviewReady] = useState(false);
const [supplierPages, setSupplierPages] = useState<SupplierPage[]>([]);
const [supplierName, setSupplierName] = useState("");
const [supplierStatus, setSupplierStatus] = useState("");
const [supplierError, setSupplierError] = useState("");
const [priceBasis, setPriceBasis] = useState<PriceBasis>("nett");
const [supplierPrice, setSupplierPrice] = useState("");
const [markup, setMarkup] = useState("55.8");
const [batch, setBatch] = useState<GeneratedAdvert[]>([]);
const [batching, setBatching] = useState(false);
const [batchProgress, setBatchProgress] = useState(0);
const [batchStatus, setBatchStatus] = useState("");
const [photoProcessing, setPhotoProcessing] = useState(false);
const [photoProgress, setPhotoProgress] = useState(0);
const [photoError, setPhotoError] = useState("");

const finalStore = useMemo(() => storeDetails(form), [form.store, form.customStore]);
const characterOptions = CHARACTER_OPTIONS[form.characterGender];
const calculatedPrice = supplierPrice
? calculateSellingPrice(Number(supplierPrice.replace(/[^0-9.]/g, "")) || 0, Number(markup) || 0)
: Number(form.price) || 0;

const update = <K extends keyof AdvertForm>(key: K, value: AdvertForm[K]) => setForm((current) => ({ ...current, [key]: value }));

useEffect(() => {
let cancelled = false;
(async () => {
const canvas = canvasRef.current;
if (!canvas) return;
setPreviewReady(false);
try {
await renderAdvert(canvas, form, finalStore.name, finalStore.address);
if (!cancelled) setPreviewReady(true);
} catch {
if (!cancelled) setPreviewReady(false);
}
})();
return () => { cancelled = true; };
}, [form, finalStore]);

const setCost = (value: string, markupValue = markup) => {
setSupplierPrice(value);
const cost = Number(value.replace(/[^0-9.]/g, ""));
const percentage = Number(markupValue.replace(/[^0-9.]/g, ""));
if (Number.isFinite(cost) && Number.isFinite(percentage)) {
const sellingPrice = String(calculateSellingPrice(cost, percentage));
setForm((current) => ({
...current,
price: sellingPrice,
previousPrice: current.saleEnabled ? sellingPrice : current.previousPrice,
}));
}
};

const setSaleMode = (saleEnabled: boolean) => {
setForm((current) => ({
...current,
saleEnabled,
previousPrice: saleEnabled && !current.saleEnabled ? current.price : current.previousPrice,
discountedPrice: saleEnabled ? current.discountedPrice || current.price : current.discountedPrice,
}));
};

const setCharacterGender = (characterGender: AdvertForm["characterGender"]) => {
setForm((current) => ({
...current,
characterGender,
emotion: characterGender === "male" ? "smile" : "confident",
}));
};

const handleSupplierFile = async (file?: File) => {
if (!file) return;
setSupplierName(file.name);
setSupplierPages([]);
setBatch([]);
setSupplierError("");
setBatchStatus("");
setSupplierStatus(file.type === "application/pdf" ? "Preparing PDF pages..." : "Preparing image...");
try {
const pages = await renderSupplierFile(file, setSupplierStatus);
setSupplierPages(pages);
setSupplierStatus(`${pages.length} product page${pages.length === 1 ? "" : "s"} ready. Choose one or generate all.`);
} catch (error) {
setSupplierError(error instanceof Error ? error.message : "The supplier file could not be opened.");
setSupplierStatus("");
}
};

const processPhoto = async (file?: File) => {
if (!file?.type.startsWith("image/")) return;
setPhotoProcessing(true);
setPhotoError("");
setPhotoProgress(0.04);
try {
const product = await isolateUploadedPhoto(file, setPhotoProgress);
update("product", product);
setPhotoProgress(1);
} catch {
setPhotoError("We could not process this photo. Please use a JPG or PNG with the full product visible.");
} finally {
setPhotoProcessing(false);
}
};

const productForPage = async (page: SupplierPage, index: number, workerRef: { current?: OcrWorker }) => {
const known = findCatalogProduct("", index, supplierName);
if (known) return known;
if (!workerRef.current) {
const { createWorker, OEM } = await import("tesseract.js");
workerRef.current = await createWorker("eng", OEM.LSTM_ONLY) as OcrWorker;
await workerRef.current.setParameters({ preserve_interword_spaces: "1" });
}
const result = await workerRef.current.recognize(page.dataUrl);
return findCatalogProduct(result.data.text, index, supplierName) || productFromOcr(result.data.text);
};

const generatePages = async (pageIndexes: number[]) => {
if (!pageIndexes.length || batching) return;
setBatching(true);
setBatch([]);
setBatchProgress(1);
setSupplierError("");
setBatchStatus(`Preparing ${pageIndexes.length} advert${pageIndexes.length === 1 ? "" : "s"}...`);
const completed: GeneratedAdvert[] = [];
const workerRef: { current?: OcrWorker } = {};
try {
for (let position = 0; position < pageIndexes.length; position++) {
const index = pageIndexes[position];
const page = supplierPages[index];
const base = position / pageIndexes.length;
setBatchStatus(`Supplier page ${page.page}: reading product details...`);
const product = await productForPage(page, index, workerRef);
setBatchStatus(`Supplier page ${page.page}: removing the product background...`);
const productImage = await isolateProduct(page.dataUrl, product.imageCrop, product.model, (progress) => {
setBatchProgress(Math.round((base + (0.2 + 0.65 * progress) / pageIndexes.length) * 100));
});
const cost = product.prices[priceBasis] ?? product.prices.nett ?? product.prices.list ?? 0;
const sellingPrice = cost ? calculateSellingPrice(cost, Number(markup) || 0) : Number(form.price) || 0;
const advertForm: AdvertForm = {
...form,
title: product.title,
model: product.model,
description: product.description,
specs: [...product.specs.slice(0, 4), "", "", "", ""].slice(0, 4),
price: String(sellingPrice),
previousPrice: form.saleEnabled ? String(sellingPrice) : form.previousPrice,
product: productImage,
};
const canvas = document.createElement("canvas");
setBatchStatus(`Supplier page ${page.page}: building advert...`);
const advertStore = storeDetails(advertForm);
await renderAdvert(canvas, advertForm, advertStore.name, advertStore.address);
const displayedPrice = advertForm.saleEnabled
? Number(advertForm.discountedPrice.replace(/[^0-9.]/g, "")) || sellingPrice
: sellingPrice;
completed.push({ page: page.page, product, form: advertForm, advert: canvas.toDataURL("image/png"), sellingPrice: displayedPrice });
setBatch([...completed]);
if (position === 0) setForm(advertForm);
setBatchProgress(Math.round(((position + 1) / pageIndexes.length) * 100));
}
setBatchStatus(`${completed.length} adverts ready - one product-only advert per PDF page.`);
} catch (error) {
setSupplierError(error instanceof Error ? error.message : "The batch could not be completed.");
setBatchStatus(completed.length ? `${completed.length} adverts completed before the error.` : "");
} finally {
await workerRef.current?.terminate();
setBatching(false);
}
};

const generateAll = () => generatePages(supplierPages.map((_, index) => index));

const downloadZip = async () => {
if (!batch.length) return;
const zip = new JSZip();
batch.forEach((item) => {
const name = `${String(item.page).padStart(2, "0")}-${item.product.model || item.product.title}`;
zip.file(`toolhub-${slug(name)}.png`, item.advert.split(",")[1], { base64: true });
});
const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
const anchor = document.createElement("a");
anchor.download = `toolhub-${slug(supplierName.replace(/\.[^.]+$/, ""))}-adverts.zip`;
anchor.href = URL.createObjectURL(blob);
anchor.click();
setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
};

const editBatchItem = (item: GeneratedAdvert) => {
setForm(item.form);
window.scrollTo({ top: 0, behavior: "smooth" });
};

const dropPhoto = (event: DragEvent<HTMLDivElement>) => {
event.preventDefault();
processPhoto(event.dataTransfer.files?.[0]);
};

return (
<main className="app-shell">
<header className="topbar">
<div className="brand-title"><span className="brand-mark">TH</span><div><strong>Toolhub Ad Studio</strong><small>Weekly campaign generator</small></div></div>
<div className="lock-note">✦ Brand template locked</div>
</header>
<div className="workspace">
<aside className="editor-panel">
<div className="panel-intro"><p className="eyebrow">Create an advert</p><h1>Weekly special</h1><p>Complete the fields below. Your approved Toolhub design updates automatically.</p></div>

<section className="form-section">
<SectionTitle icon="▣">Campaign & store</SectionTitle>
<Field label="Store name"><select value={form.store} onChange={(event) => update("store", event.target.value)}>{STORES.map((store) => <option key={store.name} value={store.name}>{store.address ? `${store.name} — ${store.address}` : store.name}</option>)}</select></Field>
{form.store === "Custom store..." && <Field label="Custom store name"><input value={form.customStore} onChange={(event) => update("customStore", event.target.value)} maxLength={36} /></Field>}
<Field label="Campaign label"><input value={form.campaign} onChange={(event) => update("campaign", event.target.value)} maxLength={28} /></Field>
<div className="two-col">
<Field label="Start date"><input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></Field>
<Field label="End date"><input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></Field>
</div>
</section>

<section className="form-section supplier-section">
<SectionTitle icon="▤">Read supplier sheet</SectionTitle>
<p className="section-help">Upload a supplier PDF. The app reads every page, extracts only the product image and creates one complete advert per page.</p>
<button className="button secondary full" type="button" disabled={batching} onClick={() => supplierInputRef.current?.click()}>▤ Choose PDF or image</button>
<input ref={supplierInputRef} hidden type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => { handleSupplierFile(event.target.files?.[0]); event.target.value = ""; }} />
{supplierName && <div className="file-summary"><span>▧ {supplierName}</span><strong>{supplierPages.length} page{supplierPages.length === 1 ? "" : "s"}</strong></div>}
{!!supplierPages.length && <div className="page-strip" aria-label="Choose supplier product page">{supplierPages.map((page, index) => <button key={page.page} type="button" disabled={batching} title={`Generate page ${page.page}`} onClick={() => generatePages([index])}><img src={page.dataUrl} alt={`Supplier page ${page.page}`} /><span>Page {page.page}</span></button>)}</div>}
{!!supplierPages.length && <button className="button primary full" type="button" disabled={batching} onClick={generateAll}>{batching ? "Generating all adverts..." : `Generate all ${supplierPages.length} advert${supplierPages.length === 1 ? "" : "s"}`}</button>}
{supplierStatus && <div className="status success"><strong>✓ {supplierStatus}</strong></div>}
{batchStatus && <div className="status working"><strong>{batchStatus}</strong>{batching && <progress max="100" value={batchProgress} />}</div>}
{supplierError && <div className="status error">{supplierError}</div>}

{!!batch.length && <div className="batch-results"><div className="batch-title"><div><p className="eyebrow">Batch ready</p><strong>{batch.length} adverts generated</strong></div><button className="button primary" type="button" disabled={batching} onClick={downloadZip}>Download ZIP</button></div><div className="batch-grid">{batch.map((item) => <article key={`${item.page}-${item.product.model}`}><img src={item.advert} alt={`Generated advert for ${item.product.title}`} /><small>PAGE {item.page} · {item.product.model}</small><strong>{item.product.title}</strong><span>{formatPrice(item.sellingPrice)}</span><div><button type="button" onClick={() => editBatchItem(item)}>Edit</button><button type="button" onClick={() => downloadDataUrl(item.advert, `toolhub-${slug(item.product.model || item.product.title)}.png`)}>Download</button></div></article>)}</div></div>}
</section>

<section className="form-section">
<SectionTitle icon="▧">Product</SectionTitle>
<div className="photo-actions"><button className="button primary" type="button" onClick={() => cameraInputRef.current?.click()}>▧ Take product photo</button><button className="button secondary" type="button" onClick={() => photoInputRef.current?.click()}>▧ Choose photo</button></div>
<input ref={cameraInputRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { processPhoto(event.target.files?.[0]); event.target.value = ""; }} />
<input ref={photoInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { processPhoto(event.target.files?.[0]); event.target.value = ""; }} />
<div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropPhoto}><span>▧</span><div><strong>Or drag a product photo here</strong><small>The background is removed automatically</small></div></div>
{photoProcessing && <div className="status working"><strong>Removing background...</strong><progress max="1" value={photoProgress} /></div>}
{photoError && <div className="status error">{photoError}</div>}
<Field label="Product name"><input value={form.title} onChange={(event) => update("title", event.target.value)} maxLength={52} /></Field>
<Field label="Model number"><input value={form.model} onChange={(event) => update("model", event.target.value)} maxLength={24} placeholder="Filled from supplier sheet" /></Field>
<Field label="Short description"><textarea value={form.description} onChange={(event) => update("description", event.target.value)} maxLength={110} rows={2} /></Field>
<div className="two-col">{form.specs.map((spec, index) => <Field key={index} label={`Specification ${index + 1}`}><input value={spec} onChange={(event) => update("specs", form.specs.map((value, specIndex) => specIndex === index ? event.target.value : value))} maxLength={34} /></Field>)}</div>
</section>

<section className="form-section">
<SectionTitle icon="R">Offer & character</SectionTitle>
<div className="price-card"><div className="price-card-title"><strong>Selling price calculator</strong><span>Nett + 55.8% default</span></div><div className="two-col"><Field label="Supplier price basis"><select value={priceBasis} onChange={(event) => setPriceBasis(event.target.value as PriceBasis)}><option value="nett">Nett price</option><option value="list">List price</option><option value="fivePlusOne">5 + 1 price</option><option value="tenPlusThree">10 + 3 price</option></select></Field><Field label="Supplier price (R)"><input inputMode="decimal" value={supplierPrice} onChange={(event) => setCost(event.target.value)} placeholder="0.00" /></Field></div><div className="two-col"><Field label="Markup added (%)"><input inputMode="decimal" value={markup} onChange={(event) => { setMarkup(event.target.value); setCost(supplierPrice, event.target.value); }} /></Field><div className="calculated-price"><span>Calculated selling price</span><strong>{formatPrice(calculatedPrice)}</strong><small>Rounded to nearest rand</small></div></div></div>
<div className="price-mode" role="group" aria-label="Price display"><button type="button" className={!form.saleEnabled ? "active" : ""} onClick={() => setSaleMode(false)}>Regular price</button><button type="button" className={form.saleEnabled ? "active" : ""} onClick={() => setSaleMode(true)}>Sale price</button></div>
{form.saleEnabled ? <div className="two-col"><Field label="Previous price"><input inputMode="numeric" value={form.previousPrice} onChange={(event) => update("previousPrice", event.target.value)} placeholder="0" /></Field><Field label="Discounted price"><input inputMode="numeric" value={form.discountedPrice} onChange={(event) => update("discountedPrice", event.target.value)} placeholder="0" /></Field></div> : <Field label="Final selling price (editable)"><input inputMode="numeric" value={form.price} onChange={(event) => update("price", event.target.value)} /></Field>}
<div className="character-gender" role="group" aria-label="Character gender"><button type="button" className={form.characterGender === "female" ? "active" : ""} onClick={() => setCharacterGender("female")}>Female</button><button type="button" className={form.characterGender === "male" ? "active" : ""} onClick={() => setCharacterGender("male")}>Male</button></div>
<Field label="Character expression"><select value={form.emotion} onChange={(event) => update("emotion", event.target.value)}>{characterOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
<div className="emotion-strip">{characterOptions.map((option) => <button key={option.id} type="button" className={form.emotion === option.id ? "active" : ""} title={option.label} onClick={() => update("emotion", option.id)}><img src={characterAsset(form.characterGender, option.id)} alt="" /><span>{option.label}</span></button>)}</div>
<Field label="Stock message"><input value={form.stock} onChange={(event) => update("stock", event.target.value)} maxLength={30} /></Field>
</section>
</aside>

<section className="preview-panel">
<div className="preview-toolbar"><div><p className="eyebrow">Live preview</p><strong>1080 x 1350 social post</strong></div><div className="toolbar-actions"><button className="button secondary" type="button" onClick={() => { setForm(INITIAL_FORM); setSupplierPrice(""); }}>↶ Reset</button><button className="button primary" type="button" disabled={!previewReady} onClick={() => canvasRef.current && downloadDataUrl(canvasRef.current.toDataURL("image/png"), `toolhub-${slug(form.model || form.title)}.png`)}>⇩ Download PNG</button></div></div>
<div className="canvas-stage"><canvas ref={canvasRef} width="1080" height="1350" aria-label="Generated Toolhub advert preview" /></div>
<div className="preview-footer"><span>▣ {form.startDate} - {form.endDate}</span><span>Store: {finalStore.name}{finalStore.address ? ` · ${finalStore.address}` : ""}</span></div>
</section>
</div>
</main>
);
}
