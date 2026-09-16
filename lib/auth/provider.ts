import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";

export type ProviderTokens = { accessToken: string; refreshToken: string; expiresAt: number };
export type ProviderIdentity = { id: string };
export interface AuthProvider {
  login(email: string, password: string): Promise<ProviderTokens>;
  requestPhoneOtp(phone: string): Promise<void>;
  verifyPhoneOtp(phone: string, otp: string): Promise<ProviderTokens>;
  verify(accessToken: string): Promise<ProviderIdentity>;
  refresh(refreshToken: string): Promise<ProviderTokens>;
  logout(accessToken: string): Promise<void>;
  reset(email: string, redirectTo: string): Promise<void>;
  redeem(tokenHash: string, type: "recovery" | "invite"): Promise<ProviderTokens>;
  updatePassword(tokens: ProviderTokens, password: string): Promise<void>;
}

function configurationError(): never {
  // Keep diagnostics actionable without logging URLs, keys, tokens, or user input.
  console.error("[auth] Supabase authentication configuration is unavailable");
  throw new Error("AUTH_CONFIGURATION_ERROR");
}

function tokens(session: Session | null): ProviderTokens {
  if (!session?.expires_at) throw new Error("UNAUTHENTICATED");
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at };
}

// Server-only adapter. Never return provider credentials to a browser or log errors from this SDK.
export function supabaseProvider(): AuthProvider {
  if (process.env.AUTH_MODE !== "supabase") configurationError();
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) configurationError();
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { configurationError(); }
  if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) configurationError();
  const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return {
    async login(email, password) {
      const { data, error } = await client().auth.signInWithPassword({ email, password });
      if (error) throw new Error("UNAUTHENTICATED");
      return tokens(data.session);
    },
    async requestPhoneOtp(phone) {
      const { error } = await client().auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
      if (error) throw new Error("UNAUTHENTICATED");
    },
    async verifyPhoneOtp(phone, token) {
      const { data, error } = await client().auth.verifyOtp({ phone, token, type: "sms" });
      if (error) throw new Error("UNAUTHENTICATED");
      return tokens(data.session);
    },
    async verify(accessToken) {
      const { data, error } = await client().auth.getUser(accessToken);
      if (error || !data.user) throw new Error("UNAUTHENTICATED");
      return { id: data.user.id };
    },
    async refresh(refreshToken) {
      const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
      if (error) throw new Error("UNAUTHENTICATED");
      return tokens(data.session);
    },
    async logout(accessToken) {
      const { error } = await client().auth.admin.signOut(accessToken, "local");
      if (error) throw new Error("UNAUTHENTICATED");
    },
    async reset(email, redirectTo) {
      const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new Error("UNAUTHENTICATED");
    },
    async redeem(token_hash, type) {
      const { data, error } = await client().auth.verifyOtp({ token_hash, type });
      if (error) throw new Error("UNAUTHENTICATED");
      return tokens(data.session);
    },
    async updatePassword(session, password) {
      const api = client();
      const { error: sessionError } = await api.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken });
      if (sessionError) throw new Error("UNAUTHENTICATED");
      const { error } = await api.auth.updateUser({ password });
      if (error) throw new Error("UNAUTHENTICATED");
    },
  };
}
