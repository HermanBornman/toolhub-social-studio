import { requirePageUser } from "@/lib/auth/page";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() { await requirePageUser();
  return (
    <AppShell title="Dashboard" subtitle="Create consistent, on-brand product content.">
      <Dashboard />
    </AppShell>
  );
}

