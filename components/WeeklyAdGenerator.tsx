"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { renderAdvert } from "@/lib/advert-renderer";
import { saveAuditRecord, savePageDrafts, loadPageDrafts } from "@/lib/audit-storage";
import { findCatalogProduct } from "@/lib/catalog";
import { analyseProductText } from "@/lib/document-analysis";
import { createPageCropCandidate, detectProductCrop, isolateUploadedPhoto, removeCandidateBackground } from "@/lib/image-processing";
import { renderSupplierFile } from "@/lib/pdf-processing";
import { calculateSellingPrice, formatPrice } from "@/lib/pricing";
import type {
  AdvertAuditRecord,
  AdvertForm,
  ExtractedValue,
  GeneratedAdvert,
  ImageCandidate,
  PageDraft,
  ProductAnalysis,
  ProductDetails,
  SupplierPage,
} from "@/lib/types";

const STORES = [
  { name: "Toolhub Polokwane Crossing", address: "" },
  { name: "Toolhub Stonewood", address: "33 Tanzanite Cres" },
  { name: "Toolhub Yzerfontein", address: "29 Buitekant St" },
  { name: "Toolhub Online", address: "" },
  { name: "All Toolhub Stores", address: "" },
  { name: "Custom store...", address: "" },
];

const CHARACTER_OPTIONS: Record<AdvertForm["characterGender"], Array<{ id: string; label: string }>> = {
  female: ["friendly", "excited", "surprised", "confident", "thoughtful", "focused"].map((id) => ({ id, label: id })),
  male: ["laugh", "smile", "thumbs-up", "wink", "wonder", "wow"].map((id) => ({ id, label: id.replace("-", " ") })),
};

const INITIAL_FORM: AdvertForm = {
  store: STORES[0].name,
  customStore: "",
  campaign: "WEEKLY SPECIAL",
  title: "VARIABLE SPEED FLOOR FAN",
  description: "Heavy-duty portable cooling for workshops and work sites.",
  model: "",
  specs: ["VARIABLE SPEED CONTROL", "LOW - MID - HIGH", "STABLE FLOOR STAND", "BUILT FOR WORK SITES"],
  condition: "",
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

type OcrWorker = {
  recognize(image: string): Promise<{ data: { text: string; confidence?: number } }>;
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  terminate(): Promise<unknown>;
};

function storeDetails(form: AdvertForm) {
  if (form.store === "Custom store...") return { name: form.customStore || "YOUR STORE NAME", address: "" };
  return STORES.find((store) => store.name === form.store) || { name: form.store, address: "" };
}

function characterAsset(gender: AdvertForm["characterGender"], emotion: string) {
  return gender === "male" ? `/toolhub/character-male-${emotion}.png` : `/toolhub/mascot-${emotion}.png`;
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

function known(value: string) {
  return value.trim() !== "Not found" && value !== "Unclear—review required" && value !== "Confirmation required" ? value.trim() : "";
}

function detailsFromAnalysis(analysis: ProductAnalysis): ProductDetails {
  return {
    brand: known(analysis.brand.value),
    category: known(analysis.category.value),
    title: known(analysis.title.value),
    model: known(analysis.model.value),
    sku: known(analysis.sku.value),
    barcode: known(analysis.barcode.value),
    description: known(analysis.description.value),
    specs: analysis.specs.map((item) => item.value),
    included: analysis.included.map((item) => item.value),
    excluded: analysis.excluded.map((item) => item.value),
    warranty: known(analysis.warranty.value),
    warnings: analysis.warnings,
    prices: {
      nett: analysis.nettPrice.value || undefined,
      list: analysis.promotionalPrice.value || undefined,
    },
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div className="section-heading"><span aria-hidden="true">{icon}</span><strong>{children}</strong></div>;
}

function ConfidenceBadge({ value }: { value: ExtractedValue<unknown> }) {
  return <span className={`confidence ${value.confidence}`} title={`Source: ${value.source}`}>{value.confidence}</span>;
}

export default function WeeklyAdGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<AdvertForm>(INITIAL_FORM);
  const [previewReady, setPreviewReady] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPages, setSupplierPages] = useState<SupplierPage[]>([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [drafts, setDrafts] = useState<PageDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [batch, setBatch] = useState<GeneratedAdvert[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [crop, setCrop] = useState({ x: 8, y: 20, width: 72, height: 58 });
  const [markup, setMarkup] = useState("55.8");

  const finalStore = useMemo(() => storeDetails(form), [form]);
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);
  const characterOptions = CHARACTER_OPTIONS[form.characterGender];
  const update = <K extends keyof AdvertForm>(key: K, value: AdvertForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateDraft = (id: string, updater: (draft: PageDraft) => PageDraft) => setDrafts((items) => items.map((item) => {
    if (item.id !== id) return item;
    const next = updater(item);
    if (next.analysis !== item.analysis || next.cleanedProductImage !== item.cleanedProductImage || next.sellingPrice !== item.sellingPrice || next.markup !== item.markup) {
      return { ...next, status: "needs-review", approvedAt: undefined, acknowledgedWarnings: false };
    }
    return next;
  }));

  useEffect(() => {
    loadPageDrafts().then((saved) => {
      setDrafts(saved.map((draft) => ({ ...draft, status: "needs-review", acknowledgedWarnings: false })));
      if (saved[0]) { setActiveDraftId(saved[0].id); setSupplierName(saved[0].sourceFilename); }
    }).catch(() => setError("Saved drafts could not be restored in this browser.")).finally(() => setDraftsLoaded(true));
  }, []);

  useEffect(() => {
    if (!draftsLoaded) return;
    const timer = setTimeout(() => {
      savePageDrafts(drafts).catch(() => setError("Drafts could not be saved. Keep this tab open and download completed adverts."));
    }, 400);
    return () => clearTimeout(timer);
  }, [drafts, draftsLoaded]);

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

  const createWorker = async () => {
    const { createWorker: makeWorker, OEM } = await import("tesseract.js");
    const worker = await makeWorker("eng", OEM.LSTM_ONLY) as OcrWorker;
    await worker.setParameters({ preserve_interword_spaces: "1" });
    return worker;
  };

  const selectCandidate = async (page: SupplierPage, analysis: ProductAnalysis) => {
    const catalog = findCatalogProduct(`${analysis.model.value} ${analysis.barcode.value}`);
    const automaticCrop = catalog?.imageCrop || await detectProductCrop(page.dataUrl);
    const fallback = await createPageCropCandidate(page.dataUrl, page.page, automaticCrop, "medium");
    fallback.label = catalog ? "Catalog-guided product crop—review required" : "Automatically detected product crop—review required";
    const embedded = page.embeddedImages.filter((candidate) => candidate.width * candidate.height >= 80_000);
    const candidates = embedded.length ? [...embedded, fallback] : [fallback];
    const selected = embedded[0] || fallback;
    return { candidates, selected };
  };

  const analysePages = async (pages: SupplierPage[], filename: string) => {
    setProcessing(true);
    setDrafts([]);
    setBatch([]);
    setError("");
    const completed: PageDraft[] = [];
    let worker: OcrWorker | undefined;
    try {
      try {
        worker = await createWorker();
      } catch {
        worker = undefined;
      }
      for (let index = 0; index < pages.length; index++) {
        const page = pages[index];
        setStatus(`Page ${page.page}: reading and classifying text...`);
        setProgress(Math.round((index / pages.length) * 100));
        let ocrText = "";
        let ocrFailed = false;
        try {
          if (!worker) throw new Error("OCR unavailable");
          const result = await worker.recognize(page.dataUrl);
          ocrText = result.data.text;
        } catch {
          ocrFailed = true;
        }
        const analysis = analyseProductText(page.embeddedText, ocrText);
        if (ocrFailed) analysis.warnings.unshift(page.embeddedText.trim()
          ? "OCR failed; embedded PDF text remains available for manual verification"
          : "Text extraction failed—manual information entry or a clearer source is required");
        setStatus(`Page ${page.page}: preparing image candidates for review...`);
        const { candidates, selected } = await selectCandidate(page, analysis);
        // An image's resolution cannot establish whether it is the actual product.
        // Wait for the user to choose or crop it before background removal.
        const cleaned = "";
        const imageError = "Select or crop the actual product, then remove its background.";
        const draft: PageDraft = {
          id: crypto.randomUUID(),
          sourceFilename: filename,
          page: page.page,
          status: "needs-review",
          pagePreview: page.dataUrl,
          rawEmbeddedText: page.embeddedText,
          rawOcrText: ocrText,
          analysis,
          imageCandidates: candidates,
          selectedImageId: selected.id,
          originalProductImage: selected.dataUrl,
          cleanedProductImage: cleaned,
          imageConfidence: "low",
          sellingPrice: null,
          sellingPriceOverridden: false,
          markup: Number(markup),
          userCorrections: [],
          acknowledgedWarnings: false,
          error: imageError || undefined,
          createdAt: new Date().toISOString(),
        };
        completed.push(draft);
        setDrafts([...completed]);
        setActiveDraftId((current) => current || draft.id);
      }
      setProgress(100);
      setStatus(`${completed.length} page draft${completed.length === 1 ? "" : "s"} ready for review. No adverts have been generated yet.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The supplier document could not be analysed.");
      setStatus(completed.length ? `${completed.length} page drafts were preserved.` : "");
    } finally {
      await worker?.terminate();
      setProcessing(false);
    }
  };

  const handleSupplierFile = async (file?: File) => {
    if (!file || processing) return;
    setProcessing(true);
    setSupplierName(file.name);

    setStatus("Opening supplier document...");
    setError("");
    try {
      const pages = await renderSupplierFile(file, setStatus);
      setSupplierPages(pages);
      setActiveDraftId("");
      await analysePages(pages, file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The supplier file could not be opened.");
      setProcessing(false);
    }
  };

  const editAnalysisField = (draft: PageDraft, key: keyof ProductAnalysis, value: string) => {
    updateDraft(draft.id, (current) => {
      const original = current.analysis[key];
      if (Array.isArray(original) || typeof original !== "object" || original === null || !("confidence" in original)) return current;
      return {
        ...current,
        analysis: { ...current.analysis, [key]: { value, confidence: "high", source: "user" } },
        userCorrections: [...current.userCorrections, `${String(key)} corrected`],
      };
    });
  };

  const editNettPrice = (draft: PageDraft, value: string) => {
    const numeric = Number(value.replace(/[^0-9.]/g, ""));
    updateDraft(draft.id, (current) => ({
      ...current,
      analysis: {
        ...current.analysis,
        nettPrice: { value: Number.isFinite(numeric) && Number.isFinite(numeric) && numeric > 0 ? numeric : null, confidence: Number.isFinite(numeric) && numeric > 0 ? "high" : "low", source: "user" },
      },
      sellingPrice: Number.isFinite(numeric) && numeric > 0 ? calculateSellingPrice(numeric, current.markup) : null,
      sellingPriceOverridden: false,
      userCorrections: [...current.userCorrections, "nettPrice corrected"],
    }));
  };

  const editPromotionalPrice = (draft: PageDraft, value: string) => {
    const numeric = Number(value.replace(/[^0-9.]/g, ""));
    updateDraft(draft.id, (current) => ({
      ...current,
      analysis: {
        ...current.analysis,
        promotionalPrice: { value: Number.isFinite(numeric) && Number.isFinite(numeric) && numeric > 0 ? numeric : null, confidence: Number.isFinite(numeric) && numeric > 0 ? "high" : "low", source: "user" },
      },
      sellingPrice: Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null,
      sellingPriceOverridden: true,
      userCorrections: [...current.userCorrections, "promotional price corrected"],
    }));
  };

  const editSpec = (draft: PageDraft, index: number, value: string) => {
    updateDraft(draft.id, (current) => ({
      ...current,
      analysis: { ...current.analysis, specs: current.analysis.specs.map((spec, itemIndex) => itemIndex === index ? { value, confidence: "high", source: "user" } : spec) },
      userCorrections: [...current.userCorrections, `specification ${index + 1} corrected`],
    }));
  };

  const removeSpec = (draft: PageDraft, index: number) => {
    updateDraft(draft.id, (current) => ({
      ...current,
      analysis: { ...current.analysis, specs: current.analysis.specs.filter((_, itemIndex) => itemIndex !== index) },
      userCorrections: [...current.userCorrections, `specification ${index + 1} removed`],
    }));
  };

  const editListItem = (draft: PageDraft, key: "included" | "excluded", index: number, value: string) => updateDraft(draft.id, (current) => ({
    ...current,
    analysis: { ...current.analysis, [key]: current.analysis[key].map((item, itemIndex) => itemIndex === index ? { value, confidence: "high", source: "user" } : item) },
    userCorrections: [...current.userCorrections, `${key} item corrected`],
  }));

  const removeListItem = (draft: PageDraft, key: "included" | "excluded", index: number) => updateDraft(draft.id, (current) => ({
    ...current,
    analysis: { ...current.analysis, [key]: current.analysis[key].filter((_, itemIndex) => itemIndex !== index) },
    userCorrections: [...current.userCorrections, `${key} item removed`],
  }));

  const addListItem = (draft: PageDraft, key: "included" | "excluded") => updateDraft(draft.id, (current) => ({
    ...current,
    analysis: { ...current.analysis, [key]: [...current.analysis[key], { value: "", confidence: "high", source: "user" }] },
    userCorrections: [...current.userCorrections, `${key} item added`],
  }));

  const addSpec = (draft: PageDraft) => updateDraft(draft.id, (current) => ({
    ...current,
    analysis: { ...current.analysis, specs: [...current.analysis.specs, { value: "", confidence: "high", source: "user" }] },
    userCorrections: [...current.userCorrections, "specification added"],
  }));

  const createSeparateProductDrafts = (draft: PageDraft) => {
    if (draft.userCorrections.includes("separate product drafts created")) return;
    const missing = Math.max(1, draft.analysis.possibleProductCount - 1);
    const extraDrafts = Array.from({ length: missing }, (_, index): PageDraft => ({
      ...draft,
      id: crypto.randomUUID(),
      status: "needs-review",
      analysis: {
        ...draft.analysis,
        title: { value: "Confirmation required", confidence: "low", source: "user" },
        model: { value: "Confirmation required", confidence: "low", source: "user" },
        sku: { value: "Not found", confidence: "low", source: "user" },
        barcode: { value: "Not found", confidence: "low", source: "user" },
        description: { value: "Not found", confidence: "low", source: "user" },
        specs: [],
        included: [],
        excluded: [],
        nettPrice: { value: null, confidence: "low", source: "user", note: "Confirmation required" },
        promotionalPrice: { value: null, confidence: "low", source: "user", note: "Confirmation required" },
        possibleProductCount: 1,
        warnings: [`Product ${index + 2} requires image and information confirmation`],
      },
      originalProductImage: "",
      cleanedProductImage: "",
      imageConfidence: "low",
      sellingPrice: null,
      sellingPriceOverridden: false,
      acknowledgedWarnings: false,
      multiProductChoice: "separate",
      userCorrections: [...draft.userCorrections, `separate product ${index + 2} draft created`],
      approvedAt: undefined,
      error: undefined,
      createdAt: new Date().toISOString(),
    }));
    setDrafts((items) => items.flatMap((item) => item.id === draft.id
      ? [{ ...item, userCorrections: [...item.userCorrections, "separate product drafts created"] }, ...extraDrafts]
      : [item]));
    if (extraDrafts[0]) setActiveDraftId(extraDrafts[0].id);
  };

  const chooseImage = async (draft: PageDraft, candidateId: string) => {
    const candidate = draft.imageCandidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    updateDraft(draft.id, (current) => ({ ...current, selectedImageId: candidate.id, originalProductImage: candidate.dataUrl, cleanedProductImage: "", error: undefined }));
    setProcessing(true);
    setStatus(`Page ${draft.page}: reprocessing selected product image...`);
    try {
      const cleaned = await removeCandidateBackground(candidate, known(draft.analysis.model.value) || `page-${draft.page}`, setProgress);
      updateDraft(draft.id, (current) => ({ ...current, cleanedProductImage: cleaned, imageConfidence: candidate.confidence, userCorrections: [...current.userCorrections, "product image changed"] }));
    } catch {
      updateDraft(draft.id, (current) => ({ ...current, error: "Background removal failed for the selected image." }));
    } finally {
      setProcessing(false);
    }
  };

  const replaceDraftImage = async (file?: File) => {
    if (!file || !activeDraft) return;
    setProcessing(true);
    setStatus(`Page ${activeDraft.page}: processing replacement image...`);
    try {
      const original = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const cleaned = await isolateUploadedPhoto(file, setProgress);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const item = new Image(); item.onload = () => resolve(item); item.onerror = reject; item.src = original;
      });
      const candidate: ImageCandidate = { id: crypto.randomUUID(), dataUrl: original, source: "uploaded-image", width: image.width, height: image.height, confidence: "high", label: `User image: ${file.name}` };
      updateDraft(activeDraft.id, (current) => ({
        ...current,
        imageCandidates: [candidate, ...current.imageCandidates],
        selectedImageId: candidate.id,
        originalProductImage: original,
        cleanedProductImage: cleaned,
        imageConfidence: "high",
        error: undefined,
        userCorrections: [...current.userCorrections, "product image replaced"],
      }));
    } catch {
      updateDraft(activeDraft.id, (current) => ({ ...current, error: "The replacement image could not be processed." }));
    } finally {
      setProcessing(false);
    }
  };

  const approveAndGenerate = async (draft: PageDraft) => {
    const title = known(draft.analysis.title.value);
    if (!title || !draft.cleanedProductImage || draft.sellingPrice === null || !Number.isFinite(draft.sellingPrice) || draft.sellingPrice <= 0) {
      updateDraft(draft.id, (current) => ({ ...current, error: "Confirm the product name, selling price and cleaned product image before generating." }));
      return;
    }
    if (draft.analysis.possibleProductCount > 1 && !draft.multiProductChoice) {
      updateDraft(draft.id, (current) => ({ ...current, error: "Choose how this possible multi-product page should be handled." }));
      return;
    }
    if (!draft.acknowledgedWarnings) {
      updateDraft(draft.id, (current) => ({ ...current, error: "Review and acknowledge the confidence warnings before generating." }));
      return;
    }
    setProcessing(true);
    setStatus(`Page ${draft.page}: generating approved Toolhub advert...`);
    const details = detailsFromAnalysis(draft.analysis);
    const condition = [...draft.analysis.excluded, ...draft.analysis.included.filter((item) => /sold separately|excluded|not included/i.test(item.value))]
      .map((item) => item.value).join(" · ");
    const advertForm: AdvertForm = {
      ...form,
      title,
      model: known(draft.analysis.model.value),
      description: known(draft.analysis.description.value),
      specs: [...draft.analysis.specs.map((item) => item.value).filter(Boolean), "", "", "", ""].slice(0, 4),
      condition,
      saleEnabled: false,
      discountedPrice: "",
      price: String(draft.sellingPrice),
      previousPrice: form.saleEnabled ? String(draft.sellingPrice) : form.previousPrice,
      product: draft.cleanedProductImage,
    };
    try {
      const canvas = document.createElement("canvas");
      const advertStore = storeDetails(advertForm);
      await renderAdvert(canvas, advertForm, advertStore.name, advertStore.address);
      const advert = canvas.toDataURL("image/png");
      const approvedAt = new Date().toISOString();
      const auditId = crypto.randomUUID();
      const generated: GeneratedAdvert = { draftId: draft.id, page: draft.page, product: details, form: advertForm, advert, sellingPrice: draft.sellingPrice, auditId };
      const audit: AdvertAuditRecord = {
        id: auditId,
        sourceFilename: draft.sourceFilename,
        page: draft.page,
        rawEmbeddedText: draft.rawEmbeddedText,
        rawOcrText: draft.rawOcrText,
        confirmedProduct: draft.analysis,
        originalProductImage: draft.originalProductImage,
        cleanedProductImage: draft.cleanedProductImage,
        userCorrections: draft.userCorrections,
        pricing: {
          nettPrice: draft.analysis.nettPrice.value,
          markup: draft.markup,
          calculatedSellingPrice: draft.analysis.nettPrice.source === "user" && draft.analysis.nettPrice.value ? calculateSellingPrice(draft.analysis.nettPrice.value, draft.markup) : null,
          finalSellingPrice: draft.sellingPrice,
          overridden: draft.sellingPriceOverridden,
        },
        advertData: advertForm,
        finalAdvert: advert,
        approvedAt,
      };
      await saveAuditRecord(audit);
      setBatch((items) => [...items.filter((item) => item.draftId !== draft.id), generated].toSorted((a, b) => a.page - b.page));
      updateDraft(draft.id, (current) => ({ ...current, status: "generated", approvedAt, error: undefined }));
      setForm(advertForm);
      setStatus(`Page ${draft.page}: approved advert generated and audit record saved.`);
    } catch (reason) {
      updateDraft(draft.id, (current) => ({ ...current, error: reason instanceof Error ? reason.message : "Advert generation failed." }));
    } finally {
      setProcessing(false);
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    batch.forEach((item) => zip.file(`toolhub-page-${String(item.page).padStart(2, "0")}-${slug(item.product.model || item.product.title)}-${item.draftId}.png`, item.advert.split(",")[1], { base64: true }));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const anchor = document.createElement("a");
    anchor.download = `toolhub-${slug(supplierName.replace(/\.[^.]+$/, ""))}-approved-adverts.zip`;
    anchor.href = URL.createObjectURL(blob);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  };

  const importPhoto = async (file?: File) => {
    if (!file || processing) return;
    setProcessing(true);
    setError("");
    setStatus("Removing product photo background…");
    try {
      const original = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const cleaned = await isolateUploadedPhoto(file, (amount) => setProgress(amount * 100));
      const draft: PageDraft = {
        id: crypto.randomUUID(), sourceFilename: file.name, page: 1, status: "needs-review",
        pagePreview: original, rawEmbeddedText: "", rawOcrText: "", analysis: analyseProductText("", ""),
        imageCandidates: [], selectedImageId: "", originalProductImage: original,
        cleanedProductImage: cleaned, imageConfidence: "low", sellingPrice: null,
        sellingPriceOverridden: false, markup: Number(markup), userCorrections: ["manual product photo"],
        acknowledgedWarnings: false, createdAt: new Date().toISOString(),
      };
      setDrafts((items) => [...items, draft]);
      setActiveDraftId(draft.id);
      setStatus("Photo ready. Enter and approve the product information and selling price below.");
    } catch {
      setError("Photo processing failed. Try a clearer image.");
    } finally { setProcessing(false); }
  };

  const setCharacterGender = (characterGender: AdvertForm["characterGender"]) => setForm((current) => ({
    ...current,
    characterGender,
    emotion: characterGender === "male" ? "smile" : "confident",
  }));

  const dropSupplier = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleSupplierFile(event.dataTransfer.files?.[0]);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-title"><span className="brand-mark">TH</span><div><strong>Toolhub Ad Studio</strong><small>Verified weekly campaign generator</small></div></div>
        <div className="lock-note">✦ Approval required before generation</div>
      </header>
      <div className="workspace">
        <aside className="editor-panel">
          <div className="panel-intro"><p className="eyebrow">Verified workflow</p><h1>Weekly special</h1><p>Import → analyse → select product → remove background → review → generate.</p></div>

          <section className="form-section">
            <SectionTitle icon="▣">Campaign & store</SectionTitle>
            <Field label="Store name"><select value={form.store} onChange={(event) => update("store", event.target.value)}>{STORES.map((store) => <option key={store.name} value={store.name}>{store.address ? `${store.name} — ${store.address}` : store.name}</option>)}</select></Field>
            {form.store === "Custom store..." ? <Field label="Custom store name"><input value={form.customStore} onChange={(event) => update("customStore", event.target.value)} maxLength={36} /></Field> : null}
            <Field label="Campaign label"><input value={form.campaign} onChange={(event) => update("campaign", event.target.value)} maxLength={28} /></Field>
            <div className="two-col">
              <Field label="Start date"><input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></Field>
              <Field label="End date"><input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></Field>
            </div>
            <Field label="Markup added (%)"><input inputMode="decimal" value={markup} onChange={(event) => {
              const value = event.target.value;
              setMarkup(value);
              const percentage = Number(value);
              if (Number.isFinite(percentage) && percentage >= 0) setDrafts((items) => items.map((draft) => ({
                ...draft,
                markup: percentage,
                status: "needs-review",
                acknowledgedWarnings: false,
                approvedAt: undefined,
                sellingPrice: draft.sellingPriceOverridden || draft.analysis.nettPrice.source !== "user" || !draft.analysis.nettPrice.value
                  ? draft.sellingPrice
                  : calculateSellingPrice(draft.analysis.nettPrice.value, percentage),
              })));
            }} /></Field>
          </section>

          <section className="form-section">
            <SectionTitle icon="▧">Product photo / manual advert</SectionTitle>
            <button className="button primary full" type="button" disabled={processing || !draftsLoaded} onClick={() => cameraInputRef.current?.click()}>Take product photo</button>
            <button className="button secondary full" type="button" disabled={processing || !draftsLoaded} onClick={() => photoInputRef.current?.click()}>Choose product photo</button>
            <input ref={cameraInputRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { importPhoto(event.target.files?.[0]); event.target.value = ""; }} />
            <input ref={photoInputRef} hidden type="file" accept="image/*" onChange={(event) => { importPhoto(event.target.files?.[0]); event.target.value = ""; }} />
          </section>

          <section className="form-section supplier-section">
            <SectionTitle icon="▤">Read supplier document</SectionTitle>
            <p className="section-help">Each page is read before you select and confirm its product image. An advert is created only after approval.</p>
            <button className="button primary full" type="button" disabled={processing || !draftsLoaded} onClick={() => supplierInputRef.current?.click()}>▤ Choose PDF or image</button>
            <input ref={supplierInputRef} hidden type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => { handleSupplierFile(event.target.files?.[0]); event.target.value = ""; }} />
            <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropSupplier}><span>▧</span><div><strong>Or drag a supplier document here</strong><small>PDF, JPG, PNG or WEBP</small></div></div>
            {supplierName ? <div className="file-summary"><span>▧ {supplierName}</span><strong>{supplierPages.length} page{supplierPages.length === 1 ? "" : "s"}</strong></div> : null}
            {status ? <div className={processing ? "status working" : "status success"}><strong>{processing ? "◌" : "✓"} {status}</strong>{processing ? <progress max="100" value={progress} /> : null}</div> : null}
            {error ? <div className="status error">{error}</div> : null}
            {drafts.length ? <div className="draft-strip" aria-label="PDF page drafts">{drafts.map((draft) => (
              <button key={draft.id} type="button" className={draft.id === activeDraftId ? "active" : ""} onClick={() => setActiveDraftId(draft.id)}>
                <img src={draft.pagePreview} alt={`PDF page ${draft.page}`} /><span>Page {draft.page}</span><small>{draft.status.replace("-", " ")}</small>
              </button>
            ))}</div> : null}
          </section>

          {activeDraft ? <section className="form-section review-section">
            <SectionTitle icon="✓">Review page {activeDraft.page}</SectionTitle>
            <div className="review-images">
              <figure><img src={activeDraft.pagePreview} alt={`Supplier PDF page ${activeDraft.page}`} /><figcaption>PDF page preview</figcaption></figure>
              <figure><img src={activeDraft.originalProductImage} alt="Selected original product" /><figcaption>Selected source</figcaption></figure>
              <figure className="transparent"><img src={activeDraft.cleanedProductImage || activeDraft.originalProductImage} alt="Background-removed product" /><figcaption>Clean product PNG</figcaption></figure>
            </div>
            <Field label="Selected product image"><select value={activeDraft.selectedImageId} disabled={processing || !draftsLoaded} onChange={(event) => chooseImage(activeDraft, event.target.value)}>{activeDraft.imageCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label} · {candidate.confidence}</option>)}</select></Field>
            <button className="button primary full" type="button" disabled={processing || !activeDraft.selectedImageId} onClick={() => chooseImage(activeDraft, activeDraft.selectedImageId)}>Confirm selected product & remove background</button>
            <details><summary>Adjust product crop on the page</summary>
              <p className="section-help">Set the product rectangle as percentages of the page. Include the full product and exclude surrounding text, packaging and graphics.</p>
              <div className="two-col">{(["x", "y", "width", "height"] as const).map((key) => <Field key={key} label={`${key} (%)`}><input type="number" min="0" max="100" value={crop[key]} onChange={(event) => setCrop((current) => ({ ...current, [key]: Number(event.target.value) }))} /></Field>)}</div>
              <button className="button secondary full" type="button" disabled={processing || !draftsLoaded} onClick={async () => {
                if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 100 || crop.y + crop.height > 100 || !Object.values(crop).every(Number.isFinite)) {
                  updateDraft(activeDraft.id, (current) => ({ ...current, error: "Choose a valid product rectangle within the page." })); return;
                }
                const candidate = await createPageCropCandidate(activeDraft.pagePreview, activeDraft.page, { x: crop.x / 100, y: crop.y / 100, width: crop.width / 100, height: crop.height / 100 }, "low");
                candidate.id = crypto.randomUUID(); candidate.label = "User-selected page crop";
                updateDraft(activeDraft.id, (current) => ({ ...current, imageCandidates: [candidate, ...current.imageCandidates], selectedImageId: candidate.id, originalProductImage: candidate.dataUrl, cleanedProductImage: "", userCorrections: [...current.userCorrections, "product crop adjusted"] }));
              }}>Preview crop before removing background</button>
            </details>
            <button className="button secondary full" type="button" disabled={processing || !draftsLoaded} onClick={() => replacementInputRef.current?.click()}>Replace selected product image</button>
            <input ref={replacementInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { replaceDraftImage(event.target.files?.[0]); event.target.value = ""; }} />

            {(["brand", "title", "category", "model", "sku", "barcode", "description", "warranty"] as const).map((key) => {
              const extracted = activeDraft.analysis[key];
              return <label className="field confidence-field" key={key}><span>{key.replace(/([A-Z])/g, " $1")} <ConfidenceBadge value={extracted} /></span><input value={String(extracted.value)} onChange={(event) => editAnalysisField(activeDraft, key, event.target.value)} /></label>;
            })}

            <div className="review-subheading"><strong>Confirmed specifications</strong><button type="button" onClick={() => addSpec(activeDraft)}>+ Add</button></div>
            {activeDraft.analysis.specs.length ? activeDraft.analysis.specs.map((spec, index) => <div className="review-row" key={index}><ConfidenceBadge value={spec} /><input value={spec.value} onChange={(event) => editSpec(activeDraft, index, event.target.value)} /><button type="button" aria-label={`Remove specification ${index + 1}`} onClick={() => removeSpec(activeDraft, index)}>×</button></div>) : <div className="status error">No specifications found—add confirmed information manually.</div>}

            <div className="two-col">
              <Field label="Nett price—verify against source"><input inputMode="decimal" value={activeDraft.analysis.nettPrice.value ?? ""} placeholder="Confirmation required" onChange={(event) => editNettPrice(activeDraft, event.target.value)} /></Field>
              <Field label="Promotional price (optional)"><input inputMode="decimal" value={activeDraft.analysis.promotionalPrice.value ?? ""} placeholder="Not found" onChange={(event) => editPromotionalPrice(activeDraft, event.target.value)} /></Field>
              <Field label="Final selling price"><input inputMode="numeric" value={activeDraft.sellingPrice ?? ""} placeholder="Not calculated" onChange={(event) => {
                const value = Number(event.target.value.replace(/[^0-9.]/g, ""));
                updateDraft(activeDraft.id, (current) => ({ ...current, sellingPrice: Number.isFinite(value) && value > 0 ? Math.round(value) : null, sellingPriceOverridden: true, userCorrections: [...current.userCorrections, "selling price overridden"] }));
              }} /></Field>
            </div>
            <button className="button secondary full" type="button" disabled={!activeDraft.analysis.nettPrice.value || processing} onClick={() => editNettPrice(activeDraft, String(activeDraft.analysis.nettPrice.value))}>Confirm nett price & calculate selling price</button>
            <p className="calculation-note">Selling price = nett × {(1 + (Number(markup)) / 100).toFixed(3)}, rounded to the nearest rand. No calculation occurs without a confirmed nett price.</p>

            {activeDraft.analysis.possibleProductCount > 1 ? <div className="multi-product"><strong>Possible multiple-product page</strong><p>{activeDraft.analysis.possibleProductCount} possible product codes were detected. Choose before generation:</p><select value={activeDraft.multiProductChoice || ""} onChange={(event) => updateDraft(activeDraft.id, (current) => ({ ...current, multiProductChoice: event.target.value as PageDraft["multiProductChoice"] }))}><option value="">Confirmation required</option><option value="separate">Create separate product adverts</option><option value="combined">Create one combined advert</option></select>{activeDraft.multiProductChoice === "separate" ? <button className="button secondary" type="button" disabled={activeDraft.userCorrections.includes("separate product drafts created")} onClick={() => createSeparateProductDrafts(activeDraft)}>{activeDraft.userCorrections.includes("separate product drafts created") ? "Additional drafts created" : "Create the additional product drafts"}</button> : null}<small>Each separate draft must have its own confirmed image, information and price. Unrelated products are never combined automatically.</small></div> : null}

            {(["included", "excluded"] as const).map((key) => <div className={`extracted-list ${key === "excluded" ? "warning" : ""}`} key={key}><div className="review-subheading"><strong>{key === "included" ? "Included items" : "Excluded / sold separately"}</strong><button type="button" onClick={() => addListItem(activeDraft, key)}>+ Add</button></div>{activeDraft.analysis[key].length ? activeDraft.analysis[key].map((item, index) => <div className="review-row" key={`${key}-${index}`}><ConfidenceBadge value={item} /><input value={item.value} onChange={(event) => editListItem(activeDraft, key, index, event.target.value)} /><button type="button" aria-label={`Remove ${key} item ${index + 1}`} onClick={() => removeListItem(activeDraft, key, index)}>×</button></div>) : <span>Not found</span>}</div>)}
            {activeDraft.analysis.warnings.length || activeDraft.error ? <div className="status error"><strong>Review required</strong>{activeDraft.analysis.warnings.map((warning) => <div key={warning}>• {warning}</div>)}{activeDraft.error ? <div>• {activeDraft.error}</div> : null}</div> : null}
            <label className="approval-check"><input type="checkbox" checked={activeDraft.acknowledgedWarnings} onChange={(event) => updateDraft(activeDraft.id, (current) => ({ ...current, acknowledgedWarnings: event.target.checked, error: undefined }))} /><span>I have checked the product, specifications, included/excluded items and price against the supplier page.</span></label>
            <button className="button primary full approve-button" type="button" disabled={processing || activeDraft.status === "generated"} onClick={() => approveAndGenerate(activeDraft)}>{activeDraft.status === "generated" ? "✓ Approved advert generated" : "Approve information & generate advert"}</button>
          </section> : null}

          <section className="form-section">
            <SectionTitle icon="☺">Character & final wording</SectionTitle>
            <div className="character-gender" role="group" aria-label="Character gender"><button type="button" className={form.characterGender === "female" ? "active" : ""} onClick={() => setCharacterGender("female")}>Female</button><button type="button" className={form.characterGender === "male" ? "active" : ""} onClick={() => setCharacterGender("male")}>Male</button></div>
            <div className="emotion-strip">{characterOptions.map((option) => <button key={option.id} type="button" className={form.emotion === option.id ? "active" : ""} title={option.label} onClick={() => update("emotion", option.id)}><img src={characterAsset(form.characterGender, option.id)} alt="" /><span>{option.label}</span></button>)}</div>
            <Field label="Stock message"><input value={form.stock} onChange={(event) => update("stock", event.target.value)} maxLength={30} /></Field>
          </section>
        </aside>

        <section className="preview-panel">
          <div className="preview-toolbar"><div><p className="eyebrow">Approved template</p><strong>1080 × 1350 social post</strong></div><div className="toolbar-actions"><button className="button secondary" type="button" onClick={() => setForm(INITIAL_FORM)}>↶ Reset template</button><button className="button primary" type="button" disabled={!previewReady} onClick={() => canvasRef.current && downloadDataUrl(canvasRef.current.toDataURL("image/png"), `toolhub-${slug(form.model || form.title)}.png`)}>⇩ Download PNG</button></div></div>
          <div className="canvas-stage"><canvas ref={canvasRef} width="1080" height="1350" aria-label="Generated Toolhub advert preview" /></div>
          <div className="preview-footer"><span>{form.startDate} – {form.endDate}</span><span>{finalStore.name}{finalStore.address ? ` · ${finalStore.address}` : ""}</span></div>
          {batch.length ? <div className="batch-results"><div className="batch-title"><div><p className="eyebrow">Approved batch</p><strong>{batch.length} advert{batch.length === 1 ? "" : "s"}</strong></div><button className="button primary" type="button" onClick={downloadZip}>Download approved ZIP</button></div><div className="batch-grid">{batch.map((item) => <article key={item.draftId}><img src={item.advert} alt={`Approved advert for ${item.product.title}`} /><small>PAGE {item.page} · AUDITED</small><strong>{item.product.title}</strong><span>{formatPrice(item.sellingPrice)}</span><button type="button" onClick={() => downloadDataUrl(item.advert, `toolhub-${slug(item.product.model || item.product.title)}.png`)}>Download</button></article>)}</div></div> : null}
        </section>
      </div>
    </main>
  );
}
