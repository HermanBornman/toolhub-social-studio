import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser, errorResponse } from "@/lib/server-user";
import { withAuthorization } from "@/lib/route-authorization";
import { authBody } from "@/lib/auth/http";

const createSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["STORE_MANAGER", "ADMIN"]),
  branchId: z.string().nullable(),
  active: z.boolean(),
  password: z.string().min(12).max(128),
}).strict();
const updateSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["STORE_MANAGER", "ADMIN"]).optional(),
  branchId: z.string().nullable().optional(),
  active: z.boolean().optional(),
}).strict().refine(value => value.role !== undefined || value.branchId !== undefined || value.active !== undefined);

async function activeBranch(id: string | null) {
  if (!id) return null;
  return prisma.branch.findFirst({ where: { id, active: true } });
}

async function GETHandler() {
  return NextResponse.json(await prisma.user.findMany({
    where: { role: { in: ["STORE_MANAGER", "ADMIN"] } },
    select: { id: true, email: true, name: true, role: true, active: true, branchId: true, branch: { select: { id: true, name: true } } },
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

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || new URL(url).protocol !== "https:") throw new Error("UNAUTHENTICATED");
    const provider = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await provider.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { name: input.name } });
    if (error || !data.user) throw new Error("USER_PROVISIONING_FAILED");

    try {
      const created = await prisma.$transaction(async tx => {
        const actor = await tx.user.findUnique({ where: { id: admin.id } });
        if (!actor?.active || actor.role !== "ADMIN") throw new Error("FORBIDDEN");
        const user = await tx.user.create({ data: { id: data.user.id, authProvider: "supabase", authProviderUserId: data.user.id, email: input.email, name: input.name, role: input.role, branchId: input.role === "STORE_MANAGER" ? input.branchId : input.branchId || null, active: input.active } });
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

    const updated = await prisma.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: admin.id } });
      if (!actor?.active || actor.role !== "ADMIN") throw new Error("FORBIDDEN");
      const before = await tx.user.findUnique({ where: { id: input.id } });
      if (!before) throw new Error("INVALID_USER_INPUT");
      const nextRole = input.role ?? before.role;
      const nextBranch = input.branchId !== undefined ? input.branchId : before.branchId;
      if (nextRole === "STORE_MANAGER" && !nextBranch) throw new Error("INVALID_USER_INPUT");
      const user = await tx.user.update({ where: { id: input.id }, data: { role: input.role, branchId: input.branchId, active: input.active } });
      await tx.auditLog.create({ data: { action: "USER_UPDATE", entityType: "USER", entityId: user.id, userId: admin.id, userName: admin.name, metadata: JSON.stringify({ role: input.role, branchId: input.branchId, active: input.active }) } });
      if (input.active === false || (input.role !== undefined && input.role !== before.role)) await tx.authSession.deleteMany({ where: { userId: user.id } });
      return user;
    });
    return NextResponse.json(updated);
  } catch (error) {
    const out = errorResponse(error);
    return NextResponse.json({ error: out.error }, { status: out.status });
  }
}

export const GET = withAuthorization("ADMIN", GETHandler);
export const POST = withAuthorization("ADMIN", POSTHandler);
export const PATCH = withAuthorization("ADMIN", PATCHHandler);
