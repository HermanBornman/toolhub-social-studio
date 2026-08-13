import Link from "next/link";
import { PackagePlus, Search, ImageOff, Image as ImageIcon, Pencil, Megaphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { formatZar } from "@/lib/format-price";
import { getCurrentUser, canManageProducts } from "@/lib/user-role";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams; const q = params.q?.trim() || ""; const state = params.state || "ACTIVE";
  const user=getCurrentUser(); const canManage=canManageProducts(user.role);
  const products = await prisma.product.findMany({ where: {
    active: state === "ALL" ? undefined : state === "INACTIVE" ? false : true,
    OR: q ? ["sku", "productName", "barcode", "brand", "category"].map((field) => ({ [field]: { contains: q } })) : undefined,
  }, orderBy: { updatedAt: "desc" } });
  return <AppShell title="Products" subtitle="Reusable product records and approved transparent cut-outs.">
    <section className="library-toolbar panel"><form className="product-search"><Search size={18}/><input name="q" defaultValue={q} placeholder="Search SKU, name, barcode, brand or category"/><select name="state" defaultValue={state}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ALL">All products</option></select><button className="secondary-button">Search</button></form>{canManage&&<Link className="primary-button" href="/products/new"><PackagePlus size={18}/> Add Product</Link>}</section>
    <section className="product-list panel">
      <div className="list-heading"><span>{products.length} PRODUCT{products.length === 1 ? "" : "S"}</span><small>Search is indexed for retail-scale lookup.</small></div>
      {products.length ? products.map((product) => <article className="product-row" key={product.id}>
        <div className="product-thumb">{product.processedImageUrl ? <img src={product.processedImageUrl} alt=""/> : <ImageOff size={22}/>}</div>
        <div className="product-identity"><strong>{product.productName}</strong><span>{product.sku} · {product.brand}</span><small>{product.category}</small></div>
        <div className="product-meta"><span>SELLING PRICE</span><strong>{formatZar(product.currentPrice)}</strong></div>
        <div className="product-meta"><span>IMAGE</span><strong className={product.backgroundRemovalStatus === "COMPLETE" ? "text-success" : "text-warning"}><ImageIcon size={14}/>{product.backgroundRemovalStatus}</strong></div>
        <span className={`status-badge ${product.active ? "approved" : "draft"}`}>{product.active ? "ACTIVE" : "INACTIVE"}</span>
        {canManage&&<div className="row-actions"><Link className="icon-link" href={`/products/${product.id}/edit`}><Pencil size={16}/> Edit</Link><Link className="primary-button compact" href={`/create?productId=${product.id}`}><Megaphone size={16}/> Create Advert</Link></div>}
      </article>) : <div className="empty-state"><PackagePlus size={30}/><h4>No matching products</h4><p>Adjust the search or add a reusable product record.</p></div>}
    </section>
  </AppShell>;
}
