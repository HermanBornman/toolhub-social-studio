import { requirePageUser } from "@/lib/auth/page";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() { await requirePageUser();
  return (
    <AppShell title="Store Manager Dashboard" subtitle="Create, finalize, and download branch-ready Toolhub adverts.">
      <Dashboard />
    </AppShell>
  );
}
