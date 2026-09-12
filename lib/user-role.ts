export const USER_ROLES = ["STAFF", "MARKETING", "MANAGER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type CurrentUser = { id: string; name: string; email: string; role: UserRole };

export function currentUserRole(): UserRole {
  const candidate = (process.env.TOOLHUB_USER_ROLE || "STAFF").toUpperCase();
  return USER_ROLES.includes(candidate as UserRole) ? candidate as UserRole : "STAFF";
}

export function getCurrentUser(): CurrentUser {
  if (!process.env.TOOLHUB_USER_ROLE || !USER_ROLES.includes(process.env.TOOLHUB_USER_ROLE.toUpperCase() as UserRole)) throw new Error("UNAUTHENTICATED");
  const role = currentUserRole();
  return {
    id: process.env.TOOLHUB_USER_ID || `dev-${role.toLowerCase()}-1`,
    name: process.env.TOOLHUB_USER_NAME || `Toolhub ${role === "STAFF" ? "Staff" : role[0] + role.slice(1).toLowerCase()}`,
    email: `${process.env.TOOLHUB_USER_ID || `dev-${role.toLowerCase()}-1`}@toolhub.local`,
    role,
  };
}

export function requireRole(allowed: readonly UserRole[], user: CurrentUser | null = getCurrentUser()) {
  if (!user || !user.id || !USER_ROLES.includes(user.role)) throw new Error("UNAUTHENTICATED");
  if (!allowed.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export function canUseOriginalImage(role: UserRole = currentUserRole()) {
  return role === "MARKETING" || role === "ADMIN";
}

export function canManageProducts(role: UserRole) {
  return role === "STAFF" || role === "MARKETING" || role === "ADMIN";
}

export function canCreateAdvert(role: UserRole) {
  return role === "STAFF" || role === "MARKETING" || role === "ADMIN";
}

export function canReviewAdvert(role: UserRole) {
  return role === "MANAGER" || role === "ADMIN";
}

export function canEditAdvert(advert: { status: string; createdByUserId: string }, user = getCurrentUser()) {
  requireRole(USER_ROLES, user);
  if (!["DRAFT", "CHANGES_REQUESTED"].includes(advert.status)) return false;
  if (user.role === "ADMIN" || user.role === "MARKETING") return true;
  return advert.createdByUserId === user.id && ["DRAFT", "CHANGES_REQUESTED"].includes(advert.status);
}

export function canApproveAdvert(advert: { createdByUserId: string; submittedByUserId?: string | null }, user = getCurrentUser()) {
  return canReviewAdvert(user.role) && advert.createdByUserId !== user.id && advert.submittedByUserId !== user.id;
}
