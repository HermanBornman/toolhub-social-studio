import type { RefObject } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { AdvertFormData } from "@/lib/advert";
import { formatZar } from "@/lib/format-price";
import { MASCOT_MOODS } from "@/lib/moods";

export function AdvertPreview({ data, canvasRef }: { data: AdvertFormData; canvasRef: RefObject<HTMLDivElement | null> }) {
  const mood = MASCOT_MOODS.find((item) => item.id === data.moodId) ?? MASCOT_MOODS[0];
  const qrValue = /^https?:\/\//.test(data.qrUrl) ? data.qrUrl : "https://www.toolhub.co.za";

  return (
    <div className="advert-frame">
      <div className="advert-canvas" ref={canvasRef} data-template="TOOLHUB_SOCIAL_MASTER_V1">
        <div className="industrial-grid" />
        <div className="brand-row">
          <div className="brand-placeholder toolhub-logo"><img src="/brand/toolhub/logo-placeholder.svg" alt="Toolhub logo placeholder" /></div>
          <div className="brand-placeholder ingco-logo"><img src="/brand/ingco/logo-placeholder.svg" alt="INGCO logo placeholder" /></div>
        </div>
        <div className="love-tools top-love">#LoveTools</div>
        <section className="campaign-copy">
          <span>CAMPAIGN</span>
          <h2>{data.campaignMessage || "CAMPAIGN MESSAGE"}</h2>
          <div className="orange-rule" />
          <h1>{data.productName || "PRODUCT NAME"}</h1>
          <small>{data.sku || "MODEL / SKU"}</small>
        </section>

        <section className="spec-panel">
          <div><span>THE KIT</span><strong>{data.primarySpecification || "PRIMARY SPECIFICATION"}</strong></div>
          {data.secondarySpecification && <p>{data.secondarySpecification}</p>}
          <div className="feature-row">
            <b>{data.feature01 || "FEATURE 01"}</b><b>{data.feature02 || "FEATURE 02"}</b>
          </div>
          <em>{data.keyBenefit || "KEY PRODUCT BENEFIT"}</em>
        </section>

        <div className={`product-stage ${data.productImage ? "has-image" : ""}`}>
          {data.productImage ? <img src={data.productImage} alt="Uploaded product" /> : <div className="product-placeholder"><span>PRODUCT IMAGE</span><small>PNG · JPG · WEBP</small></div>}
        </div>

        <div className="price-panel"><span>SELLING PRICE</span><strong>{formatZar(data.sellingPrice)}</strong><small>{data.disclaimer || "WHILE STOCKS LAST"}</small></div>

        <div className="mascot-stage" style={{ transform: `translate(${mood.xPosition}%, ${mood.yPosition}%) scale(${mood.defaultScale})` }}>
          <img src={mood.assetPath} alt={`${mood.displayName} mascot placeholder`} />
        </div>

        <div className="qr-card">
          <div className="qr-code"><QRCodeSVG value={qrValue} size={150} bgColor="#FFFFFF" fgColor="#000000" level="M" marginSize={1} /></div>
          <div><strong>SCAN TO SHOP</strong><span>toolhub.co.za</span></div>
        </div>
        <div className="love-tools bottom-love">#LoveTools</div>
        <div className="template-stamp">TOOLHUB_SOCIAL_MASTER_V1</div>
      </div>
    </div>
  );
}

