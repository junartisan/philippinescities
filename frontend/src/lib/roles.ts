import type { Role, User } from "@/lib/types";

export function userRoles(user: Pick<User, "role" | "roles"> | null): Role[] {
  if (!user) return [];
  if (user.roles?.length) return user.roles;
  return [user.role];
}

export function hasRole(user: Pick<User, "role" | "roles"> | null, role: Role): boolean {
  return userRoles(user).includes(role);
}

export function hasAnyRole(
  user: Pick<User, "role" | "roles"> | null,
  roles: Role[],
): boolean {
  return roles.some((role) => hasRole(user, role));
}
