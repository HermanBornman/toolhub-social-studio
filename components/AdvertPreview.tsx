import { dedupeSpecFields } from "@/lib/specifications";
import { powerStatement, readPower } from "@/lib/power-inclusion";
import type { RefObject } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { AdvertFormData } from "@/lib/advert";
import { formatZar } from "@/lib/format-price";
import { MASCOT_MOODS } from "@/lib/moods";
import { selectProductImage } from "@/lib/product-image";
import { ApprovedImage } from "./ApprovedImage";

export function AdvertPreview({ data, canvasRef }: { data: AdvertFormData; canvasRef?: RefObject<HTMLDivElement | null> }) {
  data = dedupeSpecFields(data);
  const mood = MASCOT_MOODS.find((item) => item.id === data.moodId) ?? MASCOT_MOODS[0];
  const qrValue = /^https?:\/\//.test(data.qrUrl) ? data.qrUrl : "https://www.toolhub.co.za";
  const productImage = selectProductImage(data);

  return (
    <div className="advert-frame">
      <div className="advert-canvas" ref={canvasRef} data-template="TOOLHUB_SOCIAL_MASTER_V1">
        <div className="industrial-grid" />
        <div className="brand-row">
          <div className="brand-image toolhub-logo"><ApprovedImage src="/brand/toolhub/toolhub-logo.png" alt="Toolhub logo" /></div>
          <div className="brand-image ingco-logo"><ApprovedImage src="/brand/ingco/ingco-logo.png" alt="INGCO logo" /></div>
        </div>
        <div className="love-tools top-love"><span>#</span><em>Love</em><strong>Tools</strong></div>
        <section className="campaign-copy">
          <span>CAMPAIGN MESSAGE</span>
          <h2>{data.campaignMessage || "CAMPAIGN MESSAGE"}</h2>
          <div className="orange-rule" />
          <h1>{data.productName || "PRODUCT NAME"}</h1>
        </section>

        <section className="spec-panel">
          <div className="spec-copy">
            <span>MODEL / SKU</span><small>{data.sku || "MODEL / SKU"}</small>
            <strong>{data.primarySpecification || "PRIMARY SPECIFICATION"}</strong>
            {data.secondarySpecification && <p>{data.secondarySpecification}</p>}
          </div>
          <div className="spec-features">
            <div className="feature-row">{data.feature01&&<b>{data.feature01}</b>}{data.feature02&&<b>{data.feature02}</b>}</div>
            {data.keyBenefit&&<em>{data.keyBenefit}</em>}
          </div>
        </section>

        <div className={`product-stage ${productImage ? "has-image" : ""}`}>
          {productImage ? <img src={productImage} alt={data.useOriginalImage ? "Original uploaded product" : "Background-removed product cut-out"} /> : <div className="product-placeholder"><span>{data.backgroundRemovalStatus === "PROCESSING" ? "REMOVING BACKGROUND…" : "PLACE PRODUCT IMAGE HERE"}</span></div>}
        </div>

        <div className={`price-panel ${data.pricingMethod === "SALE" ? "sale-price-panel" : ""}`}>{data.pricingMethod === "SALE" && data.wasPrice ? <><span className="was-price">WAS {formatZar(data.wasPrice)}</span><span>NOW</span></> : <span>SELLING PRICE</span>}<strong>{formatZar(data.sellingPrice)}</strong>{powerStatement(readPower(data.powerInclusionJson))&&<small>{powerStatement(readPower(data.powerInclusionJson))}</small>}<small>{data.disclaimer || "WHILE STOCKS LAST"}</small></div>

        <div className="mascot-stage" style={{ transform: `translate(${mood.xPosition}%, ${mood.yPosition}%) scale(${mood.defaultScale})` }}>
          <ApprovedImage src={mood.assetPath} alt={`${mood.displayName} approved mascot`} />
        </div>

        <div className="qr-card">
          <div><strong>SCAN TO SHOP</strong><span>www.toolhub.co.za</span></div>
          <div className="qr-code"><QRCodeSVG value={qrValue} size={150} bgColor="#FFFFFF" fgColor="#000000" level="M" marginSize={1} /></div>
        </div>
        <div className="love-tools bottom-love">#LoveTools</div>
        <div className="template-stamp">TOOLHUB_SOCIAL_MASTER_V1</div>
      </div>
    </div>
  );
}
