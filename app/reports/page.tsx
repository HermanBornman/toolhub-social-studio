import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user-role";
import { buildOperationalReport } from "@/lib/reports";

function reportRange(filter: string, customStart?: string, customEnd?: string) {
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date();
  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(end);
  if (!customStart) { if (filter === "today") start.setHours(0, 0, 0, 0); else if (filter === "7d") start.setDate(start.getDate() - 7); else if (filter === "month") start.setDate(1); else start.setDate(start.getDate() - 30); }
  return { start, end };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string; start?: string; end?: string }> }) {
  const user = getCurrentUser();
  if (!["MARKETING", "MANAGER", "ADMIN"].includes(user.role)) redirect("/");
  const query = await searchParams;
  const filter = query.range || "30d";
  const { start, end } = reportRange(filter, query.start, query.end);
  const [adverts, posts, ai, manual, rule] = await Promise.all([
    prisma.advertisement.findMany(),
    prisma.socialPost.findMany({ include: { advertisement: { include: { product: true } }, channels: { include: { socialChannel: true } } } }),
    prisma.aIUsage.count({ where: { action: "AI_CAPTION_GENERATE", createdAt: { gte: start, lte: end } } }),
    prisma.advertisementCaption.count({ where: { source: "MANUAL", createdAt: { gte: start, lte: end } } }),
    prisma.planningRule.findUnique({ where: { id: "default" } }),
  ]);
  const report = buildOperationalReport(adverts, posts.map((post) => ({ ...post, channels: post.channels.map((channel) => ({ service: channel.socialChannel.service, status: channel.status, attemptCount: channel.attemptCount })) })), start, end, ai, manual, rule?.sameSkuCooldownDays || 14);
  const metrics = report.metrics;
  const maxCategory = Math.max(1, ...Object.values(report.categoryMix));
  const maxCampaign = Math.max(1, ...Object.values(report.campaignMix));
  const cards: [string, string | number][] = [["Adverts Created", metrics.advertsCreated], ["Adverts Approved", metrics.advertsApproved], ["Approval Rate", `${Math.round(metrics.approvalRate * 100)}%`], ["Avg Approval Time", `${metrics.averageApprovalHours.toFixed(1)}h`], ["Posts Scheduled", metrics.postsScheduled], ["Posts Published", metrics.postsPublished], ["Posts Failed", metrics.postsFailed], ["Posts Cancelled", metrics.postsCancelled], ["AI Captions", metrics.aiCaptionsGenerated], ["Manual Captions", metrics.manualCaptions], ["Products Promoted", metrics.productsPromoted], ["Unique SKUs", metrics.uniqueSkusPromoted]];
  return <AppShell title="Publishing Performance" subtitle="Operational reliability, approval flow and content mix from local records.">
    <div className="report-stack">
      <nav className="report-filters">{[["today", "Today"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["month", "This Month"]].map(([value, label]) => <Link className={filter === value && !query.start ? "active" : ""} href={`/reports?range=${value}`} key={value}>{label}</Link>)}</nav>
      <form className="report-custom-range"><label>Custom start<input name="start" type="date" defaultValue={query.start} /></label><label>Custom end<input name="end" type="date" defaultValue={query.end} /></label><input type="hidden" name="range" value="custom" /><button className="secondary-button" type="submit">Apply range</button></form>
      <section className="report-kpis">{cards.map(([label, value]) => <article className="panel" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="report-grid">
        <article className="panel"><span className="section-kicker">PUBLISHING RELIABILITY</span><h2>{Math.round(metrics.publishingSuccessRate * 100)}% success rate</h2><dl className="report-dl"><div><dt>Failed attempts</dt><dd>{metrics.failedAttempts}</dd></div><div><dt>Retries</dt><dd>{metrics.retries}</dd></div>{Object.entries(report.channelReliability).map(([service, result]) => <div key={service}><dt>{service} success</dt><dd>{Math.round(result.rate * 100)}%</dd></div>)}</dl></article>
        <article className="panel"><span className="section-kicker">CATEGORY MIX</span><h2>Approved content variety</h2><div className="bar-chart">{Object.entries(report.categoryMix).map(([key, value]) => <div key={key}><span>{key}</span><i style={{ width: `${value / maxCategory * 100}%` }} /><b>{value}</b></div>)}</div></article>
        <article className="panel"><span className="section-kicker">CAMPAIGN MIX</span><h2>Campaign balance</h2><div className="bar-chart">{Object.entries(report.campaignMix).map(([key, value]) => <div key={key}><span>{key}</span><i style={{ width: `${value / maxCampaign * 100}%` }} /><b>{value}</b></div>)}</div></article>
        <article className="panel"><span className="section-kicker">REPETITION</span><h2>{report.repeatSkus.length ? "Review repeated SKUs" : "Cooldowns look healthy"}</h2>{report.repeatSkus.length ? <ul>{report.repeatSkus.map((sku) => <li key={sku}>{sku} repeated inside cooldown</li>)}</ul> : <p>No published SKU repetition detected inside the configured window.</p>}</article>
      </section>
    </div>
  </AppShell>;
}
