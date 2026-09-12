export { getCurrentUser as ensureCurrentUser } from "./auth/server";

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHENTICATED") return { error: "Sign in required", status: 401 };
  if (/^(INVALID_(PNG|IMAGE_DATA)|IMAGE_|TRANSPARENT_PNG_REQUIRED|PRODUCT_IMAGE_REQUIRED|FINAL_ARTWORK_DIMENSIONS_INVALID|FINAL_ARTWORK_MUST_BE_OPAQUE)/.test(message)) return { error: message, status: 400 };
  if (/^(FINAL_ARTWORK_MISSING|ARTWORK_SNAPSHOT_CHANGED|ARTWORK_REQUIRES_REVIEW|CONCURRENT_EDIT)$/.test(message)) return { error: message, status: 409 };
  if (["FORBIDDEN", "CSRF_REJECTED", "SELF_USER_CHANGE"].includes(message)) return { error: "You do not have permission to perform this action", status: 403 };
  if (message === "SELF_APPROVAL") return { error: "You cannot approve your own advert.", status: 403 };
  if (message === "INVALID_TRANSITION") return { error: "This status transition is not allowed", status: 409 };
  if (message === "RATE_LIMITED") return { error: "Please try again later", status: 429 };
  if (message === "INVALID_USER_INPUT") return { error: "Check the supplied values", status: 400 };
  return { error: "Unable to complete the request", status: 500 };
}
