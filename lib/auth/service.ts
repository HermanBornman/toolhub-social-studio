import type { PrismaClient } from "@prisma/client";
import { USER_ROLES, type CurrentUser, type UserRole } from "../user-role";
import type { AuthProvider, ProviderTokens } from "./provider";
import { newSessionSecret, sessionDigest, tokenCipher } from "./crypto";

export const SESSION_SECONDS = 12 * 60 * 60;
export const RECOVERY_SECONDS = 15 * 60;

// Injectable dependencies permit real persistence tests with a network-free provider.
export function createAuthService(db: PrismaClient, provider: AuthProvider, encryptionKey: string, now = () => new Date()) {
  const cipher = tokenCipher(encryptionKey);
  function publicUser(user: { id: string; name: string; email: string; role: string; active: boolean }): CurrentUser {
    if (!user.active || !USER_ROLES.includes(user.role as UserRole)) throw new Error("UNAUTHENTICATED");
    return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole };
  }
  async function audit(action: string, user?: CurrentUser) {
    await db.auditLog.create({ data: { action, entityType: "USER", entityId: user?.id || "anonymous", userId: user?.id, userName: user?.name } });
  }
  async function mapped(tokens: ProviderTokens) {
    const identity = await provider.verify(tokens.accessToken);
    const user = await db.user.findUnique({ where: { authProvider_authProviderUserId: { authProvider: "supabase", authProviderUserId: identity.id } } });
    if (!user) throw new Error("UNAUTHENTICATED");
    return publicUser(user);
  }
  async function start(tokens: ProviderTokens, purpose: "APP" | "RECOVERY", previousSecret?: string) {
    let user: CurrentUser;
    try { user = await mapped(tokens); }
    catch { await provider.logout(tokens.accessToken).catch(() => {}); throw new Error("UNAUTHENTICATED"); }
    const secret = newSessionSecret();
    const expiresAt = new Date(now().getTime() + (purpose === "APP" ? SESSION_SECONDS : RECOVERY_SECONDS) * 1000);
    await db.$transaction(async tx => {
      // Re-check active state in the same write transaction (deactivation must win races).
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current?.active) throw new Error("UNAUTHENTICATED");
      if (previousSecret) await tx.authSession.deleteMany({ where: { id: sessionDigest(previousSecret) } });
      await tx.authSession.deleteMany({ where: { expiresAt: { lte: now() } } });
      await tx.authSession.create({ data: { id: sessionDigest(secret), userId: user.id, providerTokens: cipher.encrypt(tokens), expiresAt, purpose } });
      await tx.auditLog.create({ data: { action: purpose === "APP" ? "USER_LOGIN" : "PASSWORD_RESET_STARTED", entityType: "USER", entityId: user.id, userId: user.id, userName: user.name } });
    });
    return { secret, user, expiresAt };
  }
  async function resolve(secret: string | undefined, purpose: "APP" | "RECOVERY" = "APP") {
    if (!secret || !/^[\w-]{43}$/.test(secret)) throw new Error("UNAUTHENTICATED");
    const row = await db.authSession.findUnique({ where: { id: sessionDigest(secret) }, include: { user: true } });
    if (!row || row.expiresAt <= now() || row.purpose !== purpose) throw new Error("UNAUTHENTICATED");
    publicUser(row.user);
    let tokens = cipher.decrypt<ProviderTokens>(row.providerTokens);
    if (tokens.expiresAt * 1000 <= now().getTime() + 60_000) {
      tokens = await provider.refresh(tokens.refreshToken);
      // The first concurrent refresh wins. Never resurrect a deleted session.
      const updated = await db.authSession.updateMany({ where: { id: row.id, providerTokens: row.providerTokens }, data: { providerTokens: cipher.encrypt(tokens) } });
      if (!updated.count) {
        const refreshed = await db.authSession.findUnique({ where: { id: row.id } });
        if (!refreshed) throw new Error("UNAUTHENTICATED");
        tokens = cipher.decrypt<ProviderTokens>(refreshed.providerTokens);
      }
    }
    const identity = await provider.verify(tokens.accessToken);
    if (row.user.authProvider !== "supabase" || row.user.authProviderUserId !== identity.id) throw new Error("UNAUTHENTICATED");
    // Check again after the network call: logout/deactivation may have happened during it.
    const current = await db.authSession.findUnique({ where: { id: row.id }, include: { user: true } });
    if (!current || current.expiresAt <= now() || current.purpose !== purpose || current.user.authProvider !== "supabase" || current.user.authProviderUserId !== identity.id) throw new Error("UNAUTHENTICATED");
    return { user: publicUser(current.user), tokens, sessionId: row.id };
  }
  return {
    async login(email: string, password: string, previousSecret?: string) {
      try { return await start(await provider.login(email, password), "APP", previousSecret); }
      catch { await audit("LOGIN_FAILED"); throw new Error("UNAUTHENTICATED"); }
    },
    async getUser(secret?: string) { return (await resolve(secret)).user; },
    async logout(secret?: string) {
      if (!secret) return;
      const row = await db.authSession.findUnique({ where: { id: sessionDigest(secret) }, include: { user: true } });
      if (!row) return;
      // Local revocation is immediate even if the provider is unavailable.
      await db.$transaction([
        db.authSession.deleteMany({ where: { id: row.id } }),
        db.auditLog.create({ data: { action: "USER_LOGOUT", entityType: "USER", entityId: row.userId, userId: row.userId, userName: row.user.name } }),
      ]);
      try { await provider.logout(cipher.decrypt<ProviderTokens>(row.providerTokens).accessToken); } catch { /* Already revoked locally; never log tokens. */ }
    },
    async requestReset(email: string, redirectTo: string) { await provider.reset(email, redirectTo).catch(() => {}); },
    async redeem(tokenHash: string, type: "recovery" | "invite", previousSecret?: string) { return start(await provider.redeem(tokenHash, type), "RECOVERY", previousSecret); },
    async recoveryUser(secret?: string) { return (await resolve(secret, "RECOVERY")).user; },
    async updatePassword(secret: string | undefined, password: string) {
      const { user, tokens } = await resolve(secret, "RECOVERY");
      await provider.updatePassword(tokens, password);
      await db.$transaction([
        db.authSession.deleteMany({ where: { userId: user.id } }),
        db.auditLog.create({ data: { action: "PASSWORD_UPDATED", entityType: "USER", entityId: user.id, userId: user.id, userName: user.name } }),
      ]);
      await provider.logout(tokens.accessToken).catch(() => {});
    },
  };
}
