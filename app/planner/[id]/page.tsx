import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PlanActions } from "@/components/PlanActions";
import { PlanItemEditor } from "@/components/PlanItemEditor";
import { AdvertPreview } from "@/components/AdvertPreview";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user-role";
import type { AdvertFormData } from "@/lib/advert";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUser();
  if (!["MARKETING", "MANAGER", "ADMIN"].includes(user.role)) redirect("/");
  const id = (await params).id;
  const [plan, approvedAdverts] = await Promise.all([
    prisma.contentPlan.findUnique({ where: { id }, include: { createdBy: true, submittedBy: true, approvedBy: true, items: { include: { advertisement: { include: { product: true } }, channel: true, socialPost: true }, orderBy: { position: "asc" } } } }),
    prisma.advertisement.findMany({ where: { status: "APPROVED" }, select: { id: true, productName: true, sku: true }, orderBy: { productName: "asc" } }),
  ]);
  if (!plan) notFound();

  return <AppShell title="Schedule Plan" subtitle={`Week of ${plan.weekStart.toLocaleDateString("en-ZA")} · ${plan.status.replaceAll("_", " ")}`}>
    <div className="plan-review-layout">
      <section className="plan-items">{plan.items.map((item) => {
        const advert = item.advertisement;
        const data: AdvertFormData = { productId: advert.productId || undefined, productName: advert.productName, sku: advert.sku, primarySpecification: advert.primarySpecification, secondarySpecification: advert.secondarySpecification || "", feature01: advert.feature01 || "", feature02: advert.feature02 || "", keyBenefit: advert.keyBenefit || "", campaignType: advert.campaignType as AdvertFormData["campaignType"], campaignMessage: advert.campaignMessage, sellingPrice: String(advert.sellingPrice), disclaimer: advert.disclaimer, moodId: advert.moodId as AdvertFormData["moodId"], originalImageUrl: advert.originalImageUrl, processedImageUrl: advert.processedImageUrl || "", backgroundRemovalStatus: advert.backgroundRemovalStatus as AdvertFormData["backgroundRemovalStatus"], useOriginalImage: advert.useOriginalImage, qrUrl: advert.qrUrl };
        const warnings = JSON.parse(item.warnings || "[]") as string[];
        return <article className="panel plan-item-card" key={item.id}>
          <div className="plan-thumb"><AdvertPreview data={data} /></div>
          <div className="plan-item-copy">
            <div><span className="section-kicker">{item.channel.service} · {item.plannedAt.toLocaleString("en-ZA")}</span><h2>{advert.productName}</h2><p>{advert.product?.category || "Uncategorised"} · {advert.campaignType}</p></div>
            <p><strong>Selected because:</strong> {item.reason}</p>
            {item.manualPinned && <b className="pinned-chip">MANUALLY PINNED</b>}
            {warnings.map((warning, index) => <p className="warning-message" key={index}>{warning}</p>)}
            <div className="caption-preview"><strong>{item.captionSource} · {item.captionState}</strong><p>{item.masterCaption}</p></div>
            {plan.status === "PLANNING_DRAFT" && <PlanItemEditor planId={plan.id} item={{ ...item, plannedAt: item.plannedAt.toISOString() }} approvedAdverts={approvedAdverts} />}
            <span className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</span>
            {item.socialPost && <a className="secondary-button" href={`/social-posts/${item.socialPost.id}`}>View scheduled item</a>}
          </div>
        </article>;
      })}</section>
      <aside><section className="panel plan-summary"><span className="section-kicker">PLAN SUMMARY</span><h2>{plan.items.length} items</h2><p>Created by {plan.createdBy.name}</p><p>Submitted by {plan.submittedBy?.name || "Not submitted"}</p><p>Approved by {plan.approvedBy?.name || "Not approved"}</p></section><PlanActions id={plan.id} status={plan.status} role={user.role} /></aside>
    </div>
  </AppShell>;
}
