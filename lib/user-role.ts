export function currentUserRole() {
  return (process.env.TOOLHUB_USER_ROLE || "STAFF").toUpperCase();
}

export function canUseOriginalImage(role = currentUserRole()) {
  return role === "MARKETING" || role === "ADMIN";
}
