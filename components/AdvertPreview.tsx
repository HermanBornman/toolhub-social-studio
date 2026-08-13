import type { RefObject } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { AdvertFormData } from "@/lib/advert";
import { formatZar } from "@/lib/format-price";
import { MASCOT_MOODS } from "@/lib/moods";
import { ApprovedImage } from "./ApprovedImage";

export function AdvertPreview({ data, canvasRef }: { data: AdvertFormData; canvasRef: RefObject<HTMLDivElement | null> }) {
  const mood = MASCOT_MOODS.find((item) => item.id === data.moodId) ?? MASCOT_MOODS[0];
  const qrValue = /^https?:\/\//.test(data.qrUrl) ? data.qrUrl : "https://www.toolhub.co.za";

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
            <p>{data.secondarySpecification || "SECONDARY SPECIFICATION"}</p>
          </div>
          <div className="spec-features">
            <div className="feature-row"><b>{data.feature01 || "FEATURE 01"}</b><b>{data.feature02 || "FEATURE 02"}</b></div>
            <em>{data.keyBenefit || "KEY PRODUCT BENEFIT"}</em>
          </div>
        </section>

        <div className={`product-stage ${data.productImage ? "has-image" : ""}`}>
          {data.productImage ? <img src={data.productImage} alt="Uploaded product" /> : <div className="product-placeholder"><span>PLACE PRODUCT IMAGE HERE</span></div>}
        </div>

        <div className="price-panel"><span>SELLING PRICE</span><strong>{formatZar(data.sellingPrice)}</strong><small>{data.disclaimer || "WHILE STOCKS LAST"}</small></div>

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