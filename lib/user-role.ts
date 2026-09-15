export const USER_ROLES = ["STORE_MANAGER", "ADMIN", "STAFF", "MARKETING", "MANAGER"] as const;
export const PHASE1_USER_ROLES = ["STORE_MANAGER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type CurrentUser = { id: string; name: string; email: string; role: UserRole; branchId?: string | null; active?: boolean };

export function requireRole(allowed: readonly UserRole[], user: CurrentUser | null = null) {
  if (!user || !user.id || !USER_ROLES.includes(user.role)) throw new Error("UNAUTHENTICATED");
  if (!allowed.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export function canUseOriginalImage(role: UserRole) {
  return role === "MARKETING" || role === "ADMIN";
}

export function canManageProducts(role: UserRole) {
  return role === "STORE_MANAGER" || role === "STAFF" || role === "MARKETING" || role === "ADMIN";
}

export function canCreateAdvert(role: UserRole) {
  return role === "STORE_MANAGER" || role === "STAFF" || role === "MARKETING" || role === "ADMIN";
}

export function canReviewAdvert(role: UserRole) {
  return role === "MANAGER" || role === "ADMIN";
}

export function canEditAdvert(advert: { status: string; createdByUserId: string }, user: CurrentUser) {
  requireRole(USER_ROLES, user);
  if (!["DRAFT", "CHANGES_REQUESTED"].includes(advert.status)) return false;
  if (user.role === "ADMIN" || user.role === "MARKETING") return true;
  return advert.createdByUserId === user.id && ["DRAFT", "CHANGES_REQUESTED"].includes(advert.status);
}

export function canFinalizeAdvert(advert: { status: string; createdByUserId: string }, user: CurrentUser) {
  return canCreateAdvert(user.role) && ["DRAFT", "CHANGES_REQUESTED"].includes(advert.status) && (user.role === "ADMIN" || advert.createdByUserId === user.id);
}

export function isStoreManager(role: UserRole) {
  return role === "STORE_MANAGER" || role === "STAFF";
}

export function canApproveAdvert(advert: { createdByUserId: string; submittedByUserId?: string | null }, user: CurrentUser) {
  return canReviewAdvert(user.role) && advert.createdByUserId !== user.id && advert.submittedByUserId !== user.id;
}
