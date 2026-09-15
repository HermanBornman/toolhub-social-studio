import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AdminUsers } from "@/components/AdminUsers";
import { requirePageUser } from "@/lib/auth/page";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const current = await requirePageUser();
  if (current.role !== "ADMIN") redirect("/");
  const [users, branches] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["STORE_MANAGER", "ADMIN"] } }, include: { branch: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return <AppShell title="Users & Branches" subtitle="Provision Store Managers and control branch access.">
    <AdminUsers initialUsers={users} branches={branches}/>
  </AppShell>;
}
