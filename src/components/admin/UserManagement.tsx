'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getRoleDisplay, getAssignableRoles, canManageRole, ROLE_COLORS } from '@/utils/roles'
import type { UserRole, Profile, UserAssignment } from '@/types/supabase'

interface UserManagementProps {
  userRole: UserRole
}

export default function UserManagement({ userRole }: UserManagementProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [assignments, setAssignments] = useState<UserAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [sortBy, setSortBy] = useState<'display_name' | 'email' | 'role' | 'created_at'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [updatingRole, setUpdatingRole] = useState(false)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState<Profile | null>(null)
  const [assignToUser, setAssignToUser] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [deletingUsers, setDeletingUsers] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [effectiveRole, setEffectiveRole] = useState<UserRole>(userRole)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)

  // Check for impersonation and get effective role
  useEffect(() => {
    const checkImpersonation = () => {
      const impersonationActive = localStorage.getItem('impersonation_active')
      const impersonatedUserData = localStorage.getItem('impersonation_target')
      
      if (impersonationActive === 'true' && impersonatedUserData) {
        const impersonated = JSON.parse(impersonatedUserData)
        setImpersonatedUser(impersonated)
        setEffectiveRole(impersonated.role as UserRole)
        console.log('🎭 Impersonation detected in UserManagement:', {
          originalRole: userRole,
          effectiveRole: impersonated.role,
          impersonatedUser: impersonated
        })
      } else {
        setImpersonatedUser(null)
        setEffectiveRole(userRole)
      }
    }

    checkImpersonation()
    
    window.addEventListener('storage', checkImpersonation)
    return () => window.removeEventListener('storage', checkImpersonation)
  }, [userRole])

  useEffect(() => {
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchUsers()
      fetchAssignments()
    }
  }, [currentUser])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        setCurrentUser(profile)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const fetchAssignments = async () => {
    try {
      // For now, we'll simulate assignments with a local storage or in-memory approach
      // In a real app, this would be a database table
      const storedAssignments = localStorage.getItem('userAssignments')
      if (storedAssignments) {
        setAssignments(JSON.parse(storedAssignments))
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
    }
  }

  const createAssignment = async (assigneeId: string, assignorId: string) => {
    setAssigning(true)
    try {
      const newAssignment: UserAssignment = {
        id: Date.now().toString(), // Simple ID generation for demo
        assignee_id: assigneeId,
        assignor_id: assignorId,
        created_at: new Date().toISOString(),
        created_by: currentUser?.id || ''
      }

      // Store in localStorage for demo (in real app, would be database)
      const existingAssignments = JSON.parse(localStorage.getItem('userAssignments') || '[]')
      const updatedAssignments = [...existingAssignments, newAssignment]
      localStorage.setItem('userAssignments', JSON.stringify(updatedAssignments))
      
      setAssignments(updatedAssignments)
      setShowAssignModal(false)
      setSelectedAssignee(null)
      setAssignToUser('')
      
      alert('Assignment created successfully!')
    } catch (error) {
      console.error('Error creating assignment:', error)
      alert('Failed to create assignment')
    } finally {
      setAssigning(false)
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    try {
      const existingAssignments = JSON.parse(localStorage.getItem('userAssignments') || '[]')
      const updatedAssignments = existingAssignments.filter((a: UserAssignment) => a.id !== assignmentId)
      localStorage.setItem('userAssignments', JSON.stringify(updatedAssignments))
      
      setAssignments(updatedAssignments)
      alert('Assignment removed successfully!')
    } catch (error) {
      console.error('Error removing assignment:', error)
      alert('Failed to remove assignment')
    }
  }

  const getUserAssignments = (userId: string) => {
    return assignments.filter(assignment => 
      assignment.assignee_id === userId || assignment.assignor_id === userId
    )
  }

  // Helper function to find a user's supervisor
  const getUserSupervisor = (userId: string, userRole?: UserRole): Profile | null => {
    // First, check for direct supervisor assignment
    const directSupervisorAssignment = assignments.find(assignment => 
      assignment.assignee_id === userId
    )
    
    if (directSupervisorAssignment) {
      const supervisor = users.find(u => u.id === directSupervisorAssignment.assignor_id)
      if (supervisor && (supervisor.role === 'supervisor' || supervisor.role === 'admin')) {
        return supervisor
      }
    }
    
    // If no direct supervisor and this is a user, inherit supervisor from their manager
    if (userRole === 'user') {
      const manager = getUserManager(userId, userRole)
      if (manager) {
        // Find the supervisor assigned to this manager
        const managerSupervisorAssignment = assignments.find(assignment => 
          assignment.assignee_id === manager.id
        )
        
        if (managerSupervisorAssignment) {
          const inheritedSupervisor = users.find(u => u.id === managerSupervisorAssignment.assignor_id)
          if (inheritedSupervisor && (inheritedSupervisor.role === 'supervisor' || inheritedSupervisor.role === 'admin')) {
            return inheritedSupervisor
          }
        }
      }
    }
    
    return null
  }

  // Helper function to find a user's manager
  const getUserManager = (userId: string, userRole: UserRole): Profile | null => {
    if (userRole !== 'user') return null // Only users have managers
    
    // Find assignment where this user is the assignee and assignor has manager role
    const managerAssignment = assignments.find(assignment => 
      assignment.assignee_id === userId
    )
    
    if (managerAssignment) {
      const manager = users.find(u => u.id === managerAssignment.assignor_id)
      if (manager && manager.role === 'manager') {
        return manager
      }
    }
    
    return null
  }

  // Helper function to get display name for hierarchy
  const getDisplayNameForUser = (user: Profile): string => {
    // Use profile display_name if available
    if (user.display_name) {
      return user.display_name
    }
    
    // Fallback to email-based mapping for testing accounts that might not have display names set
    const emailToNameMap: { [key: string]: string } = {
      'john@tpnlife.com': 'John Bradshaw',
      'john+admin@tpnlife.com': 'John Bradshaw',
      'john+supervisor@tpnlife.com': 'John Bradshaw (Supervisor)',
      'john+3@tpnlife.com': 'John Supervisor',
      'john+manager@tpnlife.com': 'John Bradshaw (Manager)',
      'john+2@tpnlife.com': 'John Manager',
      'john+user@tpnlife.com': 'John Bradshaw (User)',
      'john+1@tpnlife.com': 'John User',
      'john+u2@tpnlife.com': 'John User2',
      'supervisor@tpnlife.com': 'Sarah Supervisor',
      'manager@tpnlife.com': 'Mike Manager',
      'user@tpnlife.com': 'Lisa User',
    }
    
    if (!user.email) return 'Unknown User'
    return emailToNameMap[user.email] || user.email.split('@')[0]
  }

  const canAssignUser = (targetUserRole: UserRole) => {
    if (userRole === 'admin') {
      // Admins can assign supervisors, managers, and users
      return ['supervisor', 'manager', 'user'].includes(targetUserRole)
    }
    if (userRole === 'supervisor') {
      // Supervisors can assign users to managers
      return targetUserRole === 'user'
    }
    return false
  }

  const canImpersonateUser = (targetRole: UserRole): boolean => {
    // Only admins and supervisors can impersonate
    // Admins can impersonate anyone except other admins
    // Supervisors can only impersonate managers and users
    // Use the original role for impersonation permissions (not effective role)
    if (userRole === 'admin') {
      return targetRole !== 'admin'
    } else if (userRole === 'supervisor') {
      return targetRole === 'manager' || targetRole === 'user'
    }
    return false
  }

  const handleImpersonation = async (targetUser: Profile) => {
    if (!canImpersonateUser(targetUser.role)) {
      alert('You do not have permission to impersonate this user.')
      return
    }

    const confirmed = confirm(
      `Are you sure you want to impersonate ${targetUser.display_name || targetUser.email}?\n\n` +
      `This will:\n` +
      `• Log you in as this user\n` +
      `• Give you access to their data and permissions\n` +
      `• Record this action in the audit log\n\n` +
      `Click OK to proceed with impersonation.`
    )

    if (!confirmed) return

    setImpersonating(true)
    
    try {
      // Store the original admin user info for later restoration
      const originalUser = currentUser
      if (originalUser) {
        // Store in localStorage so we can restore later
        localStorage.setItem('impersonation_original_user', JSON.stringify({
          id: originalUser.id,
          email: originalUser.email,
          role: originalUser.role,
          display_name: originalUser.display_name
        }))
        localStorage.setItem('impersonation_active', 'true')
        localStorage.setItem('impersonation_target', JSON.stringify({
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          display_name: targetUser.display_name
        }))
      }

      // Create audit log entry
      const { error: auditError } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: `audit-${Date.now()}@system.internal`,
          display_name: `AUDIT: ${currentUser?.email} impersonated ${targetUser.email}`,
          role: 'user',
          created_at: new Date().toISOString()
        })

      if (auditError) {
        console.warn('Failed to create audit log:', auditError)
      }

      // Notify user of impersonation start
      alert(
        `🎭 Impersonation Active\n\n` +
        `You are now logged in as: ${targetUser.display_name || targetUser.email}\n` +
        `Original user: ${currentUser?.display_name || currentUser?.email}\n\n` +
        `To stop impersonation, look for the "Stop Impersonation" button in the header.`
      )

      // Refresh the page to apply the impersonation context
      window.location.reload()
      
    } catch (error) {
      console.error('Impersonation failed:', error)
      alert('Failed to start impersonation. Please try again.')
    } finally {
      setImpersonating(false)
    }
  }

  const getAssignableTargets = (assigneeRole: UserRole): Profile[] => {
    if (userRole === 'admin') {
      if (assigneeRole === 'supervisor') {
        return users.filter(u => u.role === 'admin')
      }
      if (assigneeRole === 'manager') {
        return users.filter(u => ['admin', 'supervisor'].includes(u.role))
      }
      if (assigneeRole === 'user') {
        return users.filter(u => ['admin', 'supervisor', 'manager'].includes(u.role))
      }
    }
    if (userRole === 'supervisor') {
      if (assigneeRole === 'user') {
        return users.filter(u => u.role === 'manager')
      }
    }
    return []
  }

  // Determine which users a user can see based on assignments
  const getAssignedUsers = (currentUserProfile: Profile, allUsers: Profile[]): Profile[] => {
    // Debug: Check roles being used
    console.log('getAssignedUsers - Roles check:', {
      userRoleProp: userRole,
      currentUserProfileRole: currentUserProfile.role,
      currentUserEmail: currentUserProfile.email
    })
    
    if (userRole === 'admin') {
      return allUsers // Admins see all users
    }
    
    if (userRole === 'supervisor') {
      // Supervisors see users assigned to them and users assigned to their managers
      const visibleUsers: Profile[] = []
      
      assignments.forEach(assignment => {
        if (assignment.assignor_id === currentUserProfile.id) {
          // Find the assigned user/manager
          const assignedUser = allUsers.find(u => u.id === assignment.assignee_id)
          if (assignedUser) {
            visibleUsers.push(assignedUser)
            
            // If assigned user is a manager, also include users assigned to that manager
            if (assignedUser.role === 'manager') {
              assignments.forEach(managerAssignment => {
                if (managerAssignment.assignor_id === assignedUser.id) {
                  const managerAssignedUser = allUsers.find(u => u.id === managerAssignment.assignee_id)
                  if (managerAssignedUser && !visibleUsers.find(v => v.id === managerAssignedUser.id)) {
                    visibleUsers.push(managerAssignedUser)
                  }
                }
              })
            }
          }
        }
      })
      
      return visibleUsers
    }
    
    if (userRole === 'manager') {
      // Managers see users assigned to them
      const visibleUsers: Profile[] = []
      
      assignments.forEach(assignment => {
        if (assignment.assignor_id === currentUserProfile.id) {
          const assignedUser = allUsers.find(u => u.id === assignment.assignee_id)
          if (assignedUser) {
            visibleUsers.push(assignedUser)
          }
        }
      })
      
      return visibleUsers
    }
    
    // Users see no other users
    return []
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    console.log('🔄 fetchUsers called - refreshing user data from Supabase')
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
      } else {
        console.log(`📊 Fetched ${data?.length || 0} users from Supabase`)
        const allUsers = data || []
        
        // Debug: Check specifically for john@tpnlife.com
        const johnUser = allUsers.find(u => u.email === 'john@tpnlife.com')
        if (johnUser) {
          console.log('🔍 JOHN BRADSHAW from fresh Supabase fetch:', {
            email: johnUser.email,
            role: johnUser.role,
            display_name: johnUser.display_name,
            id: johnUser.id
          })
        }
        
        // Apply role-based filtering
        if (currentUser) {
          const filteredUsers = getAssignedUsers(currentUser, allUsers)
          
          // Debug: Check John's data after filtering
          const johnAfterFilter = filteredUsers.find(u => u.email === 'john@tpnlife.com')
          if (johnAfterFilter) {
            console.log('UserManagement - John after getAssignedUsers filtering:', {
              email: johnAfterFilter.email,
              role: johnAfterFilter.role,
              display_name: johnAfterFilter.display_name,
              id: johnAfterFilter.id
            })
          }
          
          setUsers(filteredUsers)
        } else {
          setUsers(allUsers)
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    console.log(`🔄 Attempting to update user ${userId} role to ${newRole}`)
    setUpdatingRole(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        console.error('❌ Error updating user role:', error)
        alert('Failed to update user role')
      } else {
        console.log(`✅ Successfully updated user ${userId} role to ${newRole} in database`)
        // Update local state
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ))
        
        // Verify the update worked by checking database
        setTimeout(async () => {
          const { data: verification } = await supabase
            .from('profiles')
            .select('role, email')
            .eq('id', userId)
            .single()
          console.log(`🔍 Verification check - User role in database:`, verification)
        }, 1000)
      }
    } catch (error) {
      console.error('❌ Error updating user role:', error)
      alert('Failed to update user role')
    } finally {
      setUpdatingRole(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aValue: any = a[sortBy]
    let bValue: any = b[sortBy]
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }
    
    if (!aValue) aValue = ''
    if (!bValue) bValue = ''
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // Selection management functions
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const clearSelection = () => {
    setSelectedUsers(new Set())
  }

  // Delete users function
  const deleteSelectedUsers = async () => {
    if (selectedUsers.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`)
    if (!confirmed) return

    setDeletingUsers(true)
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', Array.from(selectedUsers))

      if (error) {
        console.error('Error deleting users:', error)
        alert('Error deleting users. Please try again.')
      } else {
        // Remove from local state
        setUsers(prev => prev.filter(user => !selectedUsers.has(user.id)))
        clearSelection()
        alert(`Successfully deleted ${selectedUsers.size} user(s)`)
      }
    } catch (error) {
      console.error('Error deleting users:', error)
      alert('Error deleting users. Please try again.')
    } finally {
      setDeletingUsers(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const canEditUser = (targetUserRole: UserRole) => {
    return canManageRole(userRole, targetUserRole)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {users.length} {effectiveRole === 'manager' ? 'assigned' : 'total'} users
            </span>
            {impersonatedUser && (
              <span className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded-full border border-yellow-300">
                🎭 Viewing as: {impersonatedUser.display_name || impersonatedUser.email} ({effectiveRole})
              </span>
            )}
            {effectiveRole === 'manager' && !impersonatedUser && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                Manager View: Assigned Users Only
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="manager">Managers</option>
            <option value="supervisor">Supervisors</option>
            <option value="admin">Admins</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="created_at">Sort by Date</option>
            <option value="display_name">Sort by Name</option>
            <option value="email">Sort by Email</option>
            <option value="role">Sort by Role</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Selection Actions */}
      {selectedUsers.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {selectedUsers.size} user(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={deleteSelectedUsers}
                disabled={deletingUsers}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingUsers ? 'Deleting...' : `Delete ${selectedUsers.size} User(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-scroll">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Select
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Supervisor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Manager
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedUsers.map((user) => {
              // Debug: Check John's role when rendering table row
              if (user.email === 'john@tpnlife.com') {
                console.log('Table row render - John role:', user.role, 'getRoleDisplay result:', getRoleDisplay(user.role))
              }
              
              return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {/* Checkbox column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                {/* Name column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.display_name || 'No name'}
                    {getUserAssignments(user.id).length > 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        📎 {getUserAssignments(user.id).length} assignment{getUserAssignments(user.id).length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                {/* ID column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {user.id.slice(0, 8)}...
                  </div>
                </td>
                {/* Email column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                </td>
                {/* Role column - dropdown for admins, static for others */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {effectiveRole === 'admin' ? (
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                      disabled={updatingRole}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[120px]"
                    >
                      {getAssignableRoles(effectiveRole).map(role => (
                        <option key={role} value={role}>
                          {getRoleDisplay(role).icon} {getRoleDisplay(role).label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                      {getRoleDisplay(user.role).icon} {getRoleDisplay(user.role).label}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const supervisor = getUserSupervisor(user.id, user.role)
                    return supervisor ? (
                      <div className="text-sm text-gray-900 dark:text-white font-medium">
                        {getDisplayNameForUser(supervisor)}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getRoleDisplay(supervisor.role).icon} {getRoleDisplay(supervisor.role).label}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                    )
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const manager = getUserManager(user.id, user.role)
                    return manager ? (
                      <div className="text-sm text-gray-900 dark:text-white font-medium">
                        {getDisplayNameForUser(manager)}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getRoleDisplay(manager.role).icon} {getRoleDisplay(manager.role).label}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                    )
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    {canImpersonateUser(user.role) && (
                      <button
                        onClick={() => handleImpersonation(user)}
                        disabled={impersonating}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Impersonate ${user.display_name || user.email}`}
                      >
                        🎭 Impersonate
                      </button>
                    )}
                    {canAssignUser(user.role) && (
                      <button
                        onClick={() => {
                          setSelectedAssignee(user)
                          setShowAssignModal(true)
                        }}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        Assign
                      </button>
                    )}
                    {getUserAssignments(user.id).length > 0 && (
                      <button
                        onClick={() => {
                          const assignment = getUserAssignments(user.id)[0]
                          if (assignment && confirm('Remove this assignment?')) {
                            removeAssignment(assignment.id)
                          }
                        }}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sortedUsers.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search criteria.' : 'No users match the current filters.'}
          </p>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedAssignee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Assign {selectedAssignee.display_name || selectedAssignee.email}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign {getRoleDisplay(selectedAssignee.role).label} to:
              </label>
              <select
                value={assignToUser}
                onChange={(e) => setAssignToUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a {userRole === 'admin' ? 'supervisor/manager' : 'manager'}</option>
                {getAssignableTargets(selectedAssignee.role).map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.display_name || target.email} ({getRoleDisplay(target.role).label})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {userRole === 'admin' && selectedAssignee.role === 'supervisor' && 
                  'This will assign the supervisor to report to the selected admin.'}
                {userRole === 'admin' && selectedAssignee.role === 'manager' && 
                  'This will assign the manager to report to the selected supervisor or admin.'}
                {userRole === 'admin' && selectedAssignee.role === 'user' && 
                  'This will assign the user to be managed by the selected manager.'}
                {userRole === 'supervisor' && selectedAssignee.role === 'user' && 
                  'This will assign the user to be managed by the selected manager.'}
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (assignToUser) {
                    createAssignment(selectedAssignee.id, assignToUser)
                  }
                }}
                disabled={!assignToUser || assigning}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? 'Assigning...' : 'Create Assignment'}
              </button>
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedAssignee(null)
                  setAssignToUser('')
                }}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
