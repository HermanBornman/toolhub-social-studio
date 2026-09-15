"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, FileSearch, Images, LayoutDashboard, Package, PlusSquare, Users } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Advert", icon: PlusSquare },
  { href: "/imports", label: "Import Supplier PDF", icon: FileSearch },
  { href: "/products", label: "Products", icon: Package },
  { href: "/adverts", label: "My Adverts", icon: Images },
  { href: "/admin/users", label: "Users & Branches", icon: Users, adminOnly: true },
];

export function AppShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [user,setUser]=useState({name:"",role:""});
  useEffect(()=>{fetch("/api/session").then(r=>r.json()).then(value=>{if(value.name)setUser(value);else window.location.assign("/login")});},[]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup" aria-label="Toolhub Social Studio">
          <div className="brand-mark">T</div>
          <div><strong>TOOLHUB</strong><span>SOCIAL STUDIO</span></div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon, adminOnly }) => {
            if (adminOnly && user.role!=="ADMIN") return null;
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <Icon size={19} /><span>{label}</span>{active && <ChevronRight className="nav-arrow" size={16} />}
              </Link>
            );
          })}
        </nav>
        <button className="secondary-button" onClick={async () => { const response = await fetch("/api/auth/logout", {method:"POST"}); if(response.ok) window.location.assign("/login"); }}>Sign Out</button>
        <div className="template-card">
          <span>ACTIVE TEMPLATE</span>
          <strong>Store Advert Master V1</strong>
          <small>1080 × 1350 · Locked</small>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{user.name.split(" ").map(part=>part[0]).slice(-2).join("")}</div><div><strong>{user.name}</strong><span>{user.role}</span></div>
        </div>
      </aside>
      <main className="workspace">
        <header className="page-header">
          <div><p className="eyebrow">TOOLHUB / STORE ADVERTS</p><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="status-pill"><i /> Master template active</div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
