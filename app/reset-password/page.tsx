import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { authService, sessionSecret } from "@/lib/auth/server";
export default async function ResetPasswordPage() {
  try { await authService().recoveryUser(await sessionSecret()); } catch { redirect("/forgot-password"); }
  return <AuthForm mode="update-password"/>;
}
