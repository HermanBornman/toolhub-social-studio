import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { prisma } from "../prisma";
import type { CurrentUser } from "../user-role";
import { createAuthService } from "./service";
import { supabaseProvider } from "./provider";

export const sessionCookieName = () => process.env.NODE_ENV === "production" ? "__Host-toolhub-session" : "toolhub-session";
const requestUser = new AsyncLocalStorage<CurrentUser>();
export const withRequestUser = <T>(user: CurrentUser, fn: () => Promise<T>) => requestUser.run(user, fn);
export function authService() { return createAuthService(prisma, supabaseProvider(), process.env.AUTH_ENCRYPTION_KEY || ""); }
export async function sessionSecret() { return (await cookies()).get(sessionCookieName())?.value; }
export async function getCurrentUser(): Promise<CurrentUser> {
  const current = requestUser.getStore();
  if (current) return current;
  try { return await authService().getUser(await sessionSecret()); }
  catch { throw new Error("UNAUTHENTICATED"); }
}
export const requireUser = getCurrentUser;
export const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge });
