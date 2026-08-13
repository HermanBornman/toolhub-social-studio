import { AppShell } from "./AppShell";
import { Construction } from "lucide-react";

export function ComingSoon({ title }: { title: string }) {
  return <AppShell title={title} subtitle="This workspace is planned for a later milestone."><div className="coming-soon panel"><Construction size={38} /><span>COMING SOON</span><h2>{title}</h2><p>Phase 1 is focused on the Create Advert workflow.</p></div></AppShell>;
}

