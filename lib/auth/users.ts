import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authorize } from "../authorization";
import { USER_ROLES, type CurrentUser } from "../user-role";

export const safeUserSelect = { id: true, email: true, name: true, role: true, active: true, authProvider: true, createdAt: true } as const;
const changeSchema = z.object({ role: z.enum(USER_ROLES).optional(), active: z.boolean().optional() }).strict().refine(x => x.role !== undefined || x.active !== undefined);
export async function changeUser(db: PrismaClient, actor: CurrentUser, id: string, input: unknown) {
  authorize("ADMIN", actor);
  if (actor.id === id) throw new Error("SELF_USER_CHANGE");
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_USER_INPUT");
  return db.$transaction(async tx => {
    // Re-read the actor under the write transaction; stale UI/session roles grant nothing.
    const administrator = await tx.user.findUnique({ where: { id: actor.id } });
    if (!administrator?.active || administrator.role !== "ADMIN") throw new Error("FORBIDDEN");
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw new Error("INVALID_USER_INPUT");
    const after = await tx.user.update({ where: { id }, data: parsed.data, select: safeUserSelect });
    for (const field of ["role", "active"] as const) {
      if (before[field] === after[field]) continue;
      const action = field === "role" ? "USER_ROLE_CHANGE" : after.active ? "USER_ACTIVATED" : "USER_DEACTIVATED";
      await tx.auditLog.create({ data: { action, entityType: "USER", entityId: id, userId: actor.id, userName: actor.name, metadata: JSON.stringify({ field, before: before[field], after: after[field] }) } });
    }
    if (!after.active) await tx.authSession.deleteMany({ where: { userId: id } });
    return after;
  });
}
