import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { AppShell } from "@/components/AppShell";
import { UserAdministration } from "@/components/UserAdministration";
export default async function UsersPage() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/");
  return <AppShell title="User access" subtitle="Manage Toolhub roles and account access."><UserAdministration currentUserId={user.id}/></AppShell>;
}
