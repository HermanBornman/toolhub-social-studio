"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "login" | "forgot-password" | "update-password" | "redeem" }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [link, setLink] = useState<{ tokenHash: string; type: string } | null>(null);
  const [phone, setPhone] = useState(""), [otp, setOtp] = useState(""), [otpSent, setOtpSent] = useState(false), [stayLoggedIn, setStayLoggedIn] = useState(false);
  useEffect(() => {
    if (mode === "login" && new URLSearchParams(window.location.search).get("expired") === "1") setMessage("Your session has expired. Please request a new login code.");
    if (mode !== "redeem") return;
    // Email token stays in the fragment: never sent in URLs, request logs or Referer headers.
    const values = new URLSearchParams(window.location.hash.slice(1));
    setLink({ tokenHash: values.get("token_hash") || "", type: values.get("type") || "" });
    window.history.replaceState(null, "", "/auth/confirm");
  }, [mode]);
  async function post(operation: string, body: object) {
    const response = await fetch(`/api/auth/${operation}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to complete this request.");
    return result;
  }
  async function otpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (!otpSent) { await post("request-otp", { phone }); setOtpSent(true); setMessage("A login code has been sent to your mobile number."); }
      else { await post("verify-otp", { phone, otp, stayLoggedIn }); window.location.assign("/"); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  async function adminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await post("login", Object.fromEntries(new FormData(event.currentTarget))); window.location.assign("/"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
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
  if (mode === "login") return <main className="auth-screen"><section className="auth-card">
    <div className="brand-lockup"><div className="brand-mark">T</div><div><strong>TOOLHUB</strong><span>SOCIAL STUDIO</span></div></div>
    <p className="section-kicker">YOUR CREATIVE WORKSPACE</p><h1>Welcome back</h1><p>Store Managers sign in with a secure SMS code.</p>
    <form onSubmit={otpSubmit}>
      <label>Mobile Number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0795144898" value={phone} onChange={event => setPhone(event.target.value)} disabled={otpSent} required maxLength={20}/></label>
      {otpSent && <label>6-digit OTP<input name="otp" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required maxLength={6}/></label>}
      <label className="auth-checkbox"><input type="checkbox" checked={stayLoggedIn} onChange={event => setStayLoggedIn(event.target.checked)}/> Stay logged in for 5 working days</label>
      <button className="primary-button" disabled={busy || (otpSent && otp.length !== 6)}>{busy ? "Please wait…" : otpSent ? "Verify & Sign In" : "Send OTP"}</button>
      {otpSent && <button type="button" disabled={busy} onClick={() => { setOtpSent(false); setOtp(""); setStayLoggedIn(false); setMessage(""); }}>Use a different number</button>}
      {message && <p role="status">{message}</p>}
    </form>
    <details><summary>Admin email/password sign in</summary><form onSubmit={adminSubmit}>
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>
      <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : "Sign In"}</button>
    </form></details>
    <Link href="/forgot-password">Forgot Password?</Link><small>Access is provided by your Toolhub administrator.</small>
  </section></main>;
  return <main className="auth-screen"><section className="auth-card">
    <div className="brand-lockup"><div className="brand-mark">T</div><div><strong>TOOLHUB</strong><span>SOCIAL STUDIO</span></div></div>
    <p className="section-kicker">YOUR CREATIVE WORKSPACE</p>
    <h1>{mode === "forgot-password" ? "Reset your password" : mode === "redeem" ? "Continue securely" : "Choose a password"}</h1>
    <p>{mode === "redeem" ? "Continue to verify your email link and set your password." : mode === "update-password" ? "Use at least 12 characters. You will sign in again after saving." : "Enter your account email to request a reset link."}</p>
    <form onSubmit={submit}>
      {mode === "forgot-password" && <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>}
      {mode === "update-password" && <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>}
      {mode === "update-password" && <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>}
      <button className="primary-button" disabled={busy || (mode === "redeem" && !link?.tokenHash)}>{busy ? "Please wait…" : mode === "forgot-password" ? "Send reset link" : mode === "redeem" ? "Continue" : "Save password"}</button>
      {message && <p role="status">{message}</p>}
    </form>
    <Link href="/login">Back to Sign In</Link>
    <small>Access is provided by your Toolhub administrator.</small>
  </section></main>;
}
