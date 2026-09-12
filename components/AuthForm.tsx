"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "login" | "forgot-password" | "update-password" | "redeem" }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [link, setLink] = useState<{ tokenHash: string; type: string } | null>(null);
  useEffect(() => {
    if (mode !== "redeem") return;
    // Email token stays in the fragment: never sent in URLs, request logs or Referer headers.
    const values = new URLSearchParams(window.location.hash.slice(1));
    setLink({ tokenHash: values.get("token_hash") || "", type: values.get("type") || "" });
    window.history.replaceState(null, "", "/auth/confirm");
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "update-password" && form.get("password") !== form.get("confirm")) { setMessage("Passwords must match."); return; }
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "redeem" ? link : Object.fromEntries(form)) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Unable to complete this request."); return; }
      if (mode === "forgot-password") { setMessage(result.message); return; }
      window.location.assign(mode === "redeem" ? "/reset-password" : mode === "update-password" ? "/login?reset=complete" : "/");
    } catch { setMessage("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="auth-screen"><section className="auth-card">
    <div className="brand-lockup"><div className="brand-mark">T</div><div><strong>TOOLHUB</strong><span>SOCIAL STUDIO</span></div></div>
    <p className="section-kicker">YOUR CREATIVE WORKSPACE</p>
    <h1>{mode === "login" ? "Welcome back" : mode === "forgot-password" ? "Reset your password" : mode === "redeem" ? "Continue securely" : "Choose a password"}</h1>
    <p>{mode === "redeem" ? "Continue to verify your email link and set your password." : mode === "update-password" ? "Use at least 12 characters. You will sign in again after saving." : mode === "forgot-password" ? "Enter your account email to request a reset link." : "Sign in with your Toolhub account."}</p>
    <form onSubmit={submit}>
      {(mode === "login" || mode === "forgot-password") && <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>}
      {(mode === "login" || mode === "update-password") && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "update-password" ? 12 : 1} maxLength={128} required/></label>}
      {mode === "update-password" && <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>}
      <button className="primary-button" disabled={busy || (mode === "redeem" && !link?.tokenHash)}>{busy ? "Please wait…" : mode === "login" ? "Sign In" : mode === "forgot-password" ? "Send reset link" : mode === "redeem" ? "Continue" : "Save password"}</button>
      {message && <p role="status">{message}</p>}
    </form>
    <Link href={mode === "login" ? "/forgot-password" : "/login"}>{mode === "login" ? "Forgot Password?" : "Back to Sign In"}</Link>
    <small>Access is provided by your Toolhub administrator.</small>
  </section></main>;
}
