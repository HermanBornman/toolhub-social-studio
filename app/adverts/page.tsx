import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AdvertHistoryActions } from "@/components/AdvertHistoryActions";
import { requirePageUser } from "@/lib/auth/page";
import { prisma } from "@/lib/prisma";
import { formatZar } from "@/lib/format-price";

export default async function AdvertsPage() {
  const user = await requirePageUser();
  const rows = await prisma.advertisement.findMany({
    where: { ...(user.role === "ADMIN" ? {} : { createdByUserId: user.id }), status: { not: "ARCHIVED" } },
    include: { createdBy: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return <AppShell title="Advert History" subtitle="Your drafts and frozen final adverts.">
    <section className="panel advert-history">
      <div className="panel-heading"><span className="section-kicker">DRAFTS / FINAL DOWNLOADS</span><h2>{rows.length} adverts</h2></div>
      {rows.map(advert => <article key={advert.id}>
        <div><Link href={`/adverts/${advert.id}`}><strong>{advert.productName}</strong></Link><span>{advert.sku} · {formatZar(advert.sellingPrice)} · {advert.branchName || "No branch"}</span><small>{user.role === "ADMIN" ? `Owner: ${advert.createdBy.name}` : "Your advert"}</small></div>
        <span className={`status-badge ${advert.status.toLowerCase()}`}>{advert.status.replaceAll("_", " ")}</span>
        <AdvertHistoryActions id={advert.id} status={advert.status}/>
      </article>)}
    </section>
  </AppShell>;
}
