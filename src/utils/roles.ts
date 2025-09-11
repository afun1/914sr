import type { UserRole } from '@/types/supabase'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  manager: 2,
  supervisor: 3,
  admin: 4
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  manager: 'Manager',
  supervisor: 'Supervisor',
  admin: 'Admin'
}

export const ROLE_COLORS: Record<UserRole, string> = {
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  supervisor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
}

// Check if user has access to admin panel
export const hasAdminAccess = (role: UserRole): boolean => {
  return ['manager', 'supervisor', 'admin'].includes(role)
}

// Check if user is admin
export const isAdmin = (role: UserRole): boolean => {
  return role === 'admin'
}

// Check if user can manage other users (assign/reassign)
export const canManageUsers = (role: UserRole): boolean => {
  return ['supervisor', 'admin'].includes(role)
}

// Check if user has editing rights (edit/delete)
export const hasEditingRights = (role: UserRole): boolean => {
  return role === 'admin'
}

// Check if user can see management panels
export const canSeeManagementPanels = (role: UserRole): boolean => {
  return ['manager', 'supervisor', 'admin'].includes(role)
}

// Check if user can only see their own work
export const canOnlySeeOwnWork = (role: UserRole): boolean => {
  return role === 'user'
}

// Check if user can assign users to managers (supervisors and admins)
export const canAssignToManagers = (role: UserRole): boolean => {
  return ['supervisor', 'admin'].includes(role)
}

// Check if user role A can manage user role B
export const canManageRole = (managerRole: UserRole, targetRole: UserRole): boolean => {
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole]
}

// Get all roles that a user can assign
export const getAssignableRoles = (role: UserRole): UserRole[] => {
  const userLevel = ROLE_HIERARCHY[role]
  
  // Admins can assign any role, including admin
  if (role === 'admin') {
    return Object.keys(ROLE_HIERARCHY) as UserRole[]
  }
  
  // Other roles can only assign lower levels
  return Object.entries(ROLE_HIERARCHY)
    .filter(([_, level]) => level < userLevel)
    .map(([role, _]) => role as UserRole)
}

// Check if user can view another user's content
export const canViewUserContent = (viewerRole: UserRole, contentOwnerRole: UserRole): boolean => {
  // Admin can see everything
  if (viewerRole === 'admin') return true
  
  // Users can only see their own content
  if (viewerRole === 'user') return false
  
  // Managers and Supervisors can see content from users with lower or equal hierarchy
  return ROLE_HIERARCHY[viewerRole] >= ROLE_HIERARCHY[contentOwnerRole]
}

// Get roles that a user can view content from
export const getViewableRoles = (role: UserRole): UserRole[] => {
  switch (role) {
    case 'admin':
      return ['user', 'manager', 'supervisor', 'admin']
    case 'supervisor':
      return ['user', 'manager', 'supervisor']
    case 'manager':
      return ['user', 'manager']
    case 'user':
      return ['user']
    default:
      return ['user']
  }
}

// Check if user can edit/delete content
export const canEditContent = (role: UserRole): boolean => {
  return role === 'admin'
}

// Get display text for role hierarchy access
export const getAccessScopeDescription = (role: UserRole): string => {
  switch (role) {
    case 'admin':
      return 'Can view all recordings and manage the system'
    case 'supervisor':
      return 'Can view recordings from managers and users'
    case 'manager':
      return 'Can view recordings from assigned users'
    case 'user':
      return 'Can view only your own recordings'
    default:
      return 'Limited access'
  }
}

// Get role display name with icon
export const getRoleDisplay = (role: UserRole): { label: string; icon: string } => {
  const icons = {
    user: '👤',
    manager: '👔',
    supervisor: '🎯',
    admin: '⚡'
  }
  
  return {
    label: ROLE_LABELS[role],
    icon: icons[role]
  }
}
