import type { UserRole } from '@/types/supabase'

/**
 * Check if a user role can see management panels
 * @param role - The user's role
 * @returns boolean - Whether the user can see management panels
 */
export function canSeeManagementPanels(role: UserRole): boolean {
  return ['admin', 'supervisor', 'manager'].includes(role)
}

/**
 * Check if a user can manage another user based on roles
 * @param managerRole - The role of the person doing the managing
 * @param targetRole - The role of the person being managed
 * @returns boolean - Whether the manager can manage the target
 */
export function canManageUser(managerRole: UserRole, targetRole: UserRole): boolean {
  const hierarchy: Record<UserRole, UserRole[]> = {
    admin: ['supervisor', 'manager', 'user'],
    supervisor: ['manager', 'user'],
    manager: ['user'],
    user: []
  }

  return hierarchy[managerRole]?.includes(targetRole) || false
}

/**
 * Get the hierarchy level of a role (lower number = higher authority)
 * @param role - The user's role
 * @returns number - The hierarchy level
 */
export function getRoleHierarchyLevel(role: UserRole): number {
  const levels = {
    admin: 1,
    supervisor: 2,
    manager: 3,
    user: 4
  }

  return levels[role] || 5
}

/**
 * Check if a role assignment is valid in the hierarchy
 * @param assigneeRole - The role of the person being assigned
 * @param assignorRole - The role of the person doing the assigning
 * @returns boolean - Whether the assignment is valid
 */
export function isValidAssignment(assigneeRole: UserRole, assignorRole: UserRole): boolean {
  const validAssignments = [
    { assignee: 'user', assignor: 'manager' },
    { assignee: 'manager', assignor: 'supervisor' },
    { assignee: 'supervisor', assignor: 'admin' }
  ]

  return validAssignments.some(
    va => va.assignee === assigneeRole && va.assignor === assignorRole
  )
}