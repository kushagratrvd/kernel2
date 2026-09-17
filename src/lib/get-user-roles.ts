/**
 * Shared client-safe utility to parse user roles from a session user object.
 * Handles both stringified JSON arrays, raw arrays, single role strings, and defaults to ["student"].
 */
export function getUserRoles(user: any): string[] {
  if (Array.isArray(user?.roles)) return user.roles;
  if (typeof user?.roles === "string") {
    try {
      const parsed = JSON.parse(user.roles);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [user.roles];
    }
  }
  if (user?.role && typeof user.role === "string") return [user.role];
  return ["student"];
}
