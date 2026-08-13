import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, FilePenLine, Plus, ShieldCheck } from "lucide-react";

const metrics = [
  { label: "Draft adverts", value: "0", note: "Ready to continue", icon: FilePenLine },
  { label: "Awaiting approval", value: "0", note: "Nothing pending", icon: Clock3 },
  { label: "Approved", value: "0", note: "This month", icon: CheckCircle2 },
  { label: "Scheduled", value: "0", note: "Publishing in Phase 2", icon: CalendarDays },
];

export function Dashboard() {
  return (
    <div className="dashboard-grid">
      <section className="hero-panel">
        <div>
          <span className="section-kicker">TOOLHUB AD CREATOR V1</span>
          <h2>Build the advert.<br /><em>Keep the brand.</em></h2>
          <p>Create polished product artwork from structured fields. Every logo, colour, type style, and layout position stays approved and consistent.</p>
          <Link href="/create" className="primary-button"><Plus size={20} /> Create new advert <ArrowRight size={18} /></Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="poster-mini"><b>#LoveTools</b><span>YOUR PRODUCT</span><strong>R2 499</strong><i /></div>
          <div className="orange-orbit" />
        </div>
      </section>
      <section className="metrics-grid">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <article className="metric-card" key={label}><div className="metric-icon"><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
        ))}
      </section>
      <section className="activity-panel panel">
        <div className="panel-heading"><div><span className="section-kicker">RECENT ACTIVITY</span><h3>Your latest adverts</h3></div></div>
        <div className="empty-state"><div className="empty-icon"><FilePenLine size={28} /></div><h4>No adverts yet</h4><p>Your saved drafts will appear here.</p><Link href="/create">Create your first advert <ArrowRight size={15} /></Link></div>
      </section>
      <aside className="rules-panel panel">
        <ShieldCheck size={28} />
        <span className="section-kicker">LOCKED BY DESIGN</span>
        <h3>Brand rules are built in.</h3>
        <p>Staff enter product information. The software controls the design.</p>
        <ul><li>Approved colours & typography</li><li>Fixed logo and QR positions</li><li>Approved mascot moods only</li><li>Exact 4:5 export</li></ul>
      </aside>
    </div>
  );
}

