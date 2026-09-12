import { requireRole, type CurrentUser, type UserRole } from "./user-role";
export const PERMISSIONS = {
  READ: ["STAFF","MARKETING","MANAGER","ADMIN"],
  CREATE: ["STAFF","MARKETING","ADMIN"],
  MARKETING: ["MARKETING","MANAGER","ADMIN"],
  REVIEW: ["MANAGER","ADMIN"],
  ADMIN: ["ADMIN"],
  PLANNING_SETTINGS: ["MARKETING","ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>;
export type Permission = keyof typeof PERMISSIONS;
export function authorize(permission: Permission, user?: CurrentUser | null) { return requireRole(PERMISSIONS[permission],user); }
