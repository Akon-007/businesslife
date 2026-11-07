/**
 * Role-based access control.
 *
 * Three roles exist in the product — learner, instructor, administrator — but
 * until now the checks were ad hoc: `isInstructor(player)` at each route and a
 * shared `x-admin-key` header for the admin surface. That meant an instructor
 * holding the admin key had the console, and an `admin` role account could not
 * use it at all without the header.
 *
 * The model here is deliberately small: a permission list, a role → permission
 * map, and one `can()` helper. Every route that changes someone else's record
 * asks `can(player, permission)`; the matrix is published at `/api/rbac` so the
 * instructor portal can show what each role may do.
 */
import type { Player } from './types.js'

export const PERMISSIONS = [
  'company:write',
  'cohort:read',
  'cohort:manage',
  'grade:write',
  'replay:read',
  'rubric:read',
  'lti:manage',
  'admin:read',
  'admin:configure',
] as const

export type Permission = (typeof PERMISSIONS)[number]
export type Role = Player['role']

/** Roles are cumulative: an administrator can do everything an instructor can. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  learner: ['company:write', 'cohort:read', 'rubric:read'],
  instructor: ['company:write', 'cohort:read', 'cohort:manage', 'grade:write', 'replay:read', 'rubric:read', 'lti:manage'],
  admin: [...PERMISSIONS],
}

export function permissionsFor(role: Role | undefined): readonly Permission[] {
  return ROLE_PERMISSIONS[role ?? 'learner'] ?? ROLE_PERMISSIONS.learner
}

export function can(player: { role?: Role } | null | undefined, permission: Permission): boolean {
  if (!player) return false
  return permissionsFor(player.role).includes(permission)
}

export function roleMatrix() {
  return {
    permissions: [...PERMISSIONS],
    roles: (Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => ({
      role,
      permissions: [...ROLE_PERMISSIONS[role]],
    })),
  }
}
