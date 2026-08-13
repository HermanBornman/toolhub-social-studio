import Link from "next/link";
import { Eye, Inbox } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { formatZar } from "@/lib/format-price";
import { redirect } from "next/navigation"; import { getCurrentUser } from "@/lib/user-role";

const filters=["AWAITING_APPROVAL","CHANGES_REQUESTED","APPROVED","REJECTED","ALL"];
export default async function ApprovalsPage({searchParams}:{searchParams:Promise<{status?:string}>}) { const user=getCurrentUser();if(!["MARKETING","MANAGER","ADMIN"].includes(user.role))redirect("/"); const status=(await searchParams).status||"AWAITING_APPROVAL"; const adverts=await prisma.advertisement.findMany({where:status==="ALL"?undefined:{status},include:{createdBy:{select:{name:true}},submittedBy:{select:{name:true}}},orderBy:{submittedAt:"desc"}}); return <AppShell title="Approvals" subtitle="Review, comment, and protect every advert before release.">
  <nav className="approval-tabs">{filters.map(item=><Link key={item} className={status===item?"active":""} href={`/approvals?status=${item}`}>{item.replaceAll("_"," ")}</Link>)}</nav>
  <section className="approval-list panel"><div className="list-heading"><span>{status.replaceAll("_"," ")}</span><small>{adverts.length} advert{adverts.length===1?"":"s"}</small></div>{adverts.length?adverts.map(advert=><article className="approval-row" key={advert.id}><div className="approval-thumb">{advert.productImage&&<img src={advert.productImage} alt=""/>}</div><div className="product-identity"><strong>{advert.productName}</strong><span>{advert.sku} · {advert.campaignType}</span><small>Submitted by {advert.submittedBy?.name||advert.createdBy.name}</small></div><strong className="approval-price">{formatZar(advert.sellingPrice)}</strong><span className={`status-badge ${advert.status.toLowerCase()}`}>{advert.status.replaceAll("_"," ")}</span><time>{advert.submittedAt?advert.submittedAt.toLocaleString("en-ZA"):"Not submitted"}</time><Link className="primary-button compact" href={`/approvals/${advert.id}`}><Eye size={16}/> Review</Link></article>):<div className="empty-state"><Inbox size={34}/><h4>Queue clear</h4><p>No adverts match this approval filter.</p></div>}</section>
  </AppShell>; }
