import { AppShell } from "@/components/AppShell";
import { PdfImportWorkspace } from "@/components/PdfImportWorkspace";
import {requirePageUser} from "@/lib/auth/page";

export default async function PdfImportsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requirePageUser();
  const { id } = await searchParams;
  return <AppShell title="Import supplier PDF" subtitle="Analyze and confirm every page before a Toolhub draft is created."><PdfImportWorkspace initialImportId={id} /></AppShell>;
}
