import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { withAuthorization } from "@/lib/route-authorization";
import { authBody } from "@/lib/auth/http";
import { normalizeSouthAfricanMobile } from "@/lib/auth/phone";

const createSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["STORE_MANAGER", "ADMIN"]),
  branchId: z.string().nullable(),
  active: z.boolean(),
  mobileNumber: z.string().trim().max(20).optional(),
  password: z.string().max(128).optional(),
}).strict().superRefine((value, context) => {
  if (value.role === "ADMIN" && (!value.password || value.password.length < 12)) context.addIssue({ code: "custom", path: ["password"], message: "Admin password must contain at least 12 characters" });
  if (value.role === "STORE_MANAGER" && !value.mobileNumber) context.addIssue({ code: "custom", path: ["mobileNumber"], message: "Mobile number is required" });
});
const updateSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["STORE_MANAGER", "ADMIN"]).optional(),
  branchId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  mobileNumber: z.string().trim().max(20).nullable().optional(),
}).strict().refine(value => value.role !== undefined || value.branchId !== undefined || value.active !== undefined || value.mobileNumber !== undefined);

async function activeBranch(id: string | null) {
  if (!id) return null;
  return prisma.branch.findFirst({ where: { id, active: true } });
}

async function GETHandler() {
  return NextResponse.json(await prisma.user.findMany({
    where: { role: { in: ["STORE_MANAGER", "ADMIN"] } },
    select: { id: true, email: true, name: true, mobileNumber: true, mobileE164: true, role: true, active: true, branchId: true, branch: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  }));
}

async function POSTHandler(request: Request) {
  try {
    const admin = await ensureCurrentUser();
    const parsed = createSchema.safeParse(await authBody(request));
    if (!parsed.success) throw new Error("INVALID_USER_INPUT");
    const input = parsed.data;
    if (input.role === "STORE_MANAGER" && !(await activeBranch(input.branchId))) throw new Error("INVALID_USER_INPUT");
    const mobile = input.mobileNumber ? normalizeSouthAfricanMobile(input.mobileNumber) : null;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || new URL(url).protocol !== "https:") throw new Error("UNAUTHENTICATED");
    const provider = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await provider.auth.admin.createUser({
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      email_confirm: true,
      ...(mobile ? { phone: mobile.mobileE164, phone_confirm: true } : {}),
      user_metadata: { name: input.name },
    });
    if (error || !data.user) throw new Error("USER_PROVISIONING_FAILED");

    try {
      const created = await prisma.$transaction(async tx => {
        const actor = await tx.user.findUnique({ where: { id: admin.id } });
        if (!actor?.active || actor.role !== "ADMIN") throw new Error("FORBIDDEN");
        const user = await tx.user.create({ data: { id: data.user.id, authProvider: "supabase", authProviderUserId: data.user.id, email: input.email, name: input.name, mobileNumber: mobile?.mobileNumber, mobileE164: mobile?.mobileE164, role: input.role, branchId: input.role === "STORE_MANAGER" ? input.branchId : input.branchId || null, active: input.active } });
        await tx.auditLog.create({ data: { action: "USER_CREATE", entityType: "USER", entityId: user.id, userId: admin.id, userName: admin.name, metadata: JSON.stringify({ role: user.role, branchId: user.branchId, active: user.active }) } });
        return user;
      });
      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      await provider.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const out = errorResponse(error);
    return NextResponse.json({ error: out.error }, { status: out.status });
  }
}

async function PATCHHandler(request: Request) {
  try {
    const admin = await ensureCurrentUser();
    const parsed = updateSchema.safeParse(await authBody(request));
    if (!parsed.success) throw new Error("INVALID_USER_INPUT");
    const input = parsed.data;
    if (admin.id === input.id && (input.role !== undefined || input.active !== undefined)) throw new Error("SELF_USER_CHANGE");
    if (input.branchId && !(await activeBranch(input.branchId))) throw new Error("INVALID_USER_INPUT");
    const mobile = input.mobileNumber ? normalizeSouthAfricanMobile(input.mobileNumber) : input.mobileNumber === null ? null : undefined;
    const existing = await prisma.user.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("INVALID_USER_INPUT");
    const nextRole = input.role ?? existing.role;
    const nextBranch = input.branchId !== undefined ? input.branchId : existing.branchId;
    const nextMobile = mobile === undefined ? existing.mobileE164 : mobile?.mobileE164 ?? null;
    if (nextRole === "STORE_MANAGER" && !nextBranch) throw new Error("INVALID_USER_INPUT");
    if (nextRole === "STORE_MANAGER" && (input.role === "STORE_MANAGER" || mobile !== undefined) && !nextMobile) throw new Error("INVALID_USER_INPUT");

    let provider: ReturnType<typeof createClient> | null = null;
    if (mobile !== undefined && mobile?.mobileE164 !== existing.mobileE164) {
      if (existing.authProvider !== "supabase" || !existing.authProviderUserId) throw new Error("INVALID_USER_INPUT");
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key || new URL(url).protocol !== "https:") throw new Error("UNAUTHENTICATED");
      provider = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await provider.auth.admin.updateUserById(existing.authProviderUserId, { phone: mobile?.mobileE164 || undefined, phone_confirm: Boolean(mobile) });
      if (error) throw new Error("USER_PROVISIONING_FAILED");
    }

    try {
    const updated = await prisma.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: admin.id } });
      if (!actor?.active || actor.role !== "ADMIN") throw new Error("FORBIDDEN");
      const before = await tx.user.findUnique({ where: { id: input.id } });
      if (!before) throw new Error("INVALID_USER_INPUT");
      const user = await tx.user.update({ where: { id: input.id }, data: { role: input.role, branchId: input.branchId, active: input.active, ...(mobile === undefined ? {} : { mobileNumber: mobile?.mobileNumber ?? null, mobileE164: mobile?.mobileE164 ?? null }) } });
      await tx.auditLog.create({ data: { action: "USER_UPDATE", entityType: "USER", entityId: user.id, userId: admin.id, userName: admin.name, metadata: JSON.stringify({ role: input.role, branchId: input.branchId, active: input.active, mobileChanged: mobile !== undefined }) } });
      if (input.active === false || (input.role !== undefined && input.role !== before.role) || mobile !== undefined) await tx.authSession.deleteMany({ where: { userId: user.id } });
      return user;
    });
    return NextResponse.json(updated);
    } catch (error) {
      if (provider && existing.authProviderUserId) await provider.auth.admin.updateUserById(existing.authProviderUserId, { phone: existing.mobileE164 || undefined, phone_confirm: Boolean(existing.mobileE164) }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const out = errorResponse(error);
    return NextResponse.json({ error: out.error }, { status: out.status });
  }
}

export const GET = withAuthorization("ADMIN", GETHandler);
export const POST = withAuthorization("ADMIN", POSTHandler);
export const PATCH = withAuthorization("ADMIN", PATCHHandler);
