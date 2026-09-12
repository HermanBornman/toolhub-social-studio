import { prisma } from "./prisma";
import { getCurrentUser } from "./user-role";

export async function ensureCurrentUser() {
  const user = getCurrentUser();
  await prisma.user.upsert({
    where: { id: user.id },
    update: { name: user.name, role: user.role },
    create: user,
  });
  return user;
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHENTICATED") return { error: "User identity is not configured", status: 401 };
  if (/^(INVALID_(PNG|IMAGE_DATA)|IMAGE_|TRANSPARENT_PNG_REQUIRED|PRODUCT_IMAGE_REQUIRED|FINAL_ARTWORK_DIMENSIONS_INVALID|FINAL_ARTWORK_MUST_BE_OPAQUE)/.test(message)) return { error: message, status: 400 };
  if (/^(FINAL_ARTWORK_MISSING|ARTWORK_SNAPSHOT_CHANGED|ARTWORK_REQUIRES_REVIEW|CONCURRENT_EDIT)$/.test(message)) return { error: message, status: 409 };
  if (message === "FORBIDDEN") return { error: "You do not have permission to perform this action", status: 403 };
  if (message === "SELF_APPROVAL") return { error: "You cannot approve your own advert.", status: 403 };
  if (message === "INVALID_TRANSITION") return { error: "This status transition is not allowed", status: 409 };
  return { error: "Unable to complete the request", status: 500 };
}
