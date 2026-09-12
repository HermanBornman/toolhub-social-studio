import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthorization } from "@/lib/route-authorization";
import { ensureCurrentUser } from "@/lib/server-user";
import { changeUser } from "@/lib/auth/users";
import { authBody } from "@/lib/auth/http";

export const PATCH = withAuthorization("ADMIN", async (request: Request, context: { params: Promise<{ id: string }> }) =>
  NextResponse.json(await changeUser(prisma, await ensureCurrentUser(), (await context.params).id, await authBody(request)))
);
