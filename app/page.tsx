import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <AppShell title="Dashboard" subtitle="Create consistent, on-brand product content.">
      <Dashboard />
    </AppShell>
  );
}

