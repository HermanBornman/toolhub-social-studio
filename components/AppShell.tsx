"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, LayoutDashboard, Package, PlusSquare, Settings } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Advert", icon: PlusSquare },
  { href: "/products", label: "Products", icon: Package },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [user,setUser]=useState({name:"Toolhub Staff",role:"STAFF"});
  useEffect(()=>{fetch("/api/session").then(r=>r.json()).then(value=>{if(value.name)setUser(value)});},[]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup" aria-label="Toolhub Social Studio">
          <div className="brand-mark">T</div>
          <div><strong>TOOLHUB</strong><span>SOCIAL STUDIO</span></div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon }) => {
            if (user.role === "MANAGER" && ["/create","/settings"].includes(href)) return null;
            if (!["MANAGER","ADMIN"].includes(user.role) && href === "/approvals") return null;
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <Icon size={19} /><span>{label}</span>{active && <ChevronRight className="nav-arrow" size={16} />}
              </Link>
            );
          })}
        </nav>
        <div className="template-card">
          <span>ACTIVE TEMPLATE</span>
          <strong>Social Master V1</strong>
          <small>1080 × 1350 · Locked</small>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{user.name.split(" ").map(part=>part[0]).slice(-2).join("")}</div><div><strong>{user.name}</strong><span>{user.role}</span></div>
        </div>
      </aside>
      <main className="workspace">
        <header className="page-header">
          <div><p className="eyebrow">TOOLHUB / SOCIAL MEDIA</p><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="status-pill"><i /> Master template active</div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
