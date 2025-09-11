'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/supabase'
import { getRoleDisplay, getAssignableRoles, canManageRole, ROLE_COLORS } from '@/utils/roles'

interface Profile {
  id: string
  email: string | null
  role: UserRole
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
  display_name?: string | null
  assigned_to_manager?: string | null
  assigned_to_supervisor?: string | null
  assigned_to_admin?: string | null
  assigned_by?: string | null
  assigned_at?: string | null
  created_at?: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [sortBy, setSortBy] = useState<'display_name' | 'email' | 'role' | 'created_at'>('created_at')    
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [updatingRole, setUpdatingRole] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState<Profile | null>(null)
  const [assignToUser, setAssignToUser] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [deletingUsers, setDeletingUsers] = useState(false)

  // Modal state management  
  const [showManageModal, setShowManageModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState<'manager' | 'supervisor' | 'admin'>('manager')
  const [selectedAssignor, setSelectedAssignor] = useState<Profile | null>(null)
  const [modalSearchTerm, setModalSearchTerm] = useState('')

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
        // Get available assignors for a specific user role
  const getAvailableAssignors = (userRole: UserRole) => {
    switch (userRole) {
      case 'user':
        return users.filter(u => ['manager', 'supervisor', 'admin'].includes(u.role))
      case 'manager':
        return users.filter(u => ['supervisor', 'admin'].includes(u.role))
      case 'supervisor':
        return users.filter(u => u.role === 'admin')
      case 'admin':
        return [] // Admins can't be assigned to anyone
      default:
        return []
    }
  }

  // Check if an assignment is valid
  const isValidAssignment = (assigneeRole: UserRole, assignorRole: UserRole) => {
    const validCombinations = [
      { assignee: 'user', assignor: ['manager', 'supervisor', 'admin'] },
      { assignee: 'manager', assignor: ['supervisor', 'admin'] },
      { assignee: 'supervisor', assignor: ['admin'] }
    ]

    return validCombinations.some(combo => 
      combo.assignee === assigneeRole && combo.assignor.includes(assignorRole)
    )
  }
      const devMode = process.env.NODE_ENV === 'development'
      if (devMode) {
        const authData = localStorage.getItem('dev-auth-user')
        if (authData) {
          const devUser = JSON.parse(authData)
          console.log('🔧 UserManagement - Using dev mode user:', devUser.email)
          
          // Create a profile-like object for the dev user
          const devProfile: Profile = {
            id: devUser.id,
            email: devUser.email,
            display_name: devUser.user_metadata?.full_name || devUser.email.split('@')[0],
            role: getUserRoleFromEmail(devUser.email) as UserRole,
            avatar_url: null,
            created_at: devUser.created_at || new Date().toISOString(),
            updated_at: devUser.updated_at || new Date().toISOString()
          }
          
          setCurrentUser(devProfile)
          return
        }
      }
      
      // Fallback to Supabase user
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

  const getUserRoleFromEmail = (email: string): string => {
    const roleMap: { [key: string]: string } = {
      'admin@test.com': 'admin',
      'manager@test.com': 'manager', 
      'user@test.com': 'user',
      'john@tpnlife.com': 'admin',
      'john+admin@tpnlife.com': 'admin',
      'john+supervisor@tpnlife.com': 'supervisor',
      'john+manager@tpnlife.com': 'manager',
      'john+user@tpnlife.com': 'user'
    }
    return roleMap[email] || 'user'
  }

  const fetchAssignments = async () => {
    // Assignments are now stored directly in the profiles table
    // No need for separate assignment fetching - they come with the user profiles
    console.log('✅ Assignments are now part of profile data')
  }

  // Function to create assignment in both assignments table and profiles table
  const createAssignment = async (assigneeId: string, assignorId: string, field: string) => {
    try {
      const assignee = users.find(u => u.id === assigneeId)
      const assignor = users.find(u => u.id === assignorId)

      if (!assignee || !assignor) {
        throw new Error('Invalid user selection')
      }

      console.log('🎯 createAssignment called:', { assignee: assignee.email, assignor: assignor.email, field })

      // 1. First, insert into assignments table (the new way)
      const { error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          assignee_id: assigneeId,
          assignor_id: assignorId,
          assignee_role: assignee.role,
          assignor_role: assignor.role
        })

      if (assignmentError) {
        console.error('❌ Assignment table error:', assignmentError)
        throw assignmentError
      }

      console.log('✅ Assignment recorded in assignments table')

      // 2. Also update the profiles table (for backward compatibility)
      const updateData: any = {}
      updateData[field] = assignorId
      updateData.assigned_by = currentUser?.id
      updateData.assigned_at = new Date().toISOString()

      console.log('📝 Updating profile field:', field, 'for user:', assignee.email)

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', assigneeId)

      if (profileError) {
        console.error('❌ Profile update error:', profileError)
        throw profileError
      }

      console.log('✅ Profile updated successfully')
      console.log('🎉 Assignment created and recorded in both tables!')

      // Refresh the user list
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error creating assignment:', error)
    }
  }

  const removeAssignment = async (userId: string, assignmentType: 'admin' | 'supervisor' | 'manager') => {
    try {
      const updateField = `assigned_to_${assignmentType}`
      
      // Remove assignment from Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          [updateField]: null,
          assigned_at: null,
          assigned_by: null
        })
        .eq('id', userId)

      if (error) {
        throw error
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { 
              ...user, 
              [updateField]: null,
              assigned_at: null,
              assigned_by: null
            }
          : user
      ))

      alert('Assignment removed successfully!')
      
      // Note: No refresh needed since local state is updated immediately
    } catch (error) {
      console.error('Error removing assignment:', error)
      alert(`Failed to remove assignment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getUserAssignments = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) {
      console.log(`🔍 getUserAssignments: User ${userId} not found`)
      return []
    }
    
    console.log(`🔍 getUserAssignments for ${user.email}:`, {
      assigned_to_admin: user.assigned_to_admin,
      assigned_to_supervisor: user.assigned_to_supervisor,
      assigned_to_manager: user.assigned_to_manager,
      assigned_at: user.assigned_at,
      assigned_by: user.assigned_by
    })
    
    const assignments = []
    
    // Check each assignment field and create assignment objects
    if (user.assigned_to_admin) {
      const admin = users.find(u => u.id === user.assigned_to_admin)
      if (admin) {
        assignments.push({
          id: userId, // Use the user's ID for removal
          type: 'admin',
          supervisorName: getDisplayNameForUser(admin),
          assignedAt: user.assigned_at ? new Date(user.assigned_at).toLocaleDateString() : 'Unknown'
        })
      }
    }
    
    if (user.assigned_to_supervisor) {
      const supervisor = users.find(u => u.id === user.assigned_to_supervisor)
      if (supervisor) {
        assignments.push({
          id: userId, // Use the user's ID for removal
          type: 'supervisor',
          supervisorName: getDisplayNameForUser(supervisor),
          assignedAt: user.assigned_at ? new Date(user.assigned_at).toLocaleDateString() : 'Unknown'
        })
      }
    }
    
    if (user.assigned_to_manager) {
      const manager = users.find(u => u.id === user.assigned_to_manager)
      if (manager) {
        assignments.push({
          id: userId, // Use the user's ID for removal
          type: 'manager', 
          supervisorName: getDisplayNameForUser(manager),
          assignedAt: user.assigned_at ? new Date(user.assigned_at).toLocaleDateString() : 'Unknown'
        })
      }
    }
    
    return assignments
  }

  // Helper function to find a user's supervisor
  const getUserSupervisor = (userId: string, userRole?: UserRole): Profile | null => {
    const user = users.find(u => u.id === userId)
    if (!user) return null
    
    // Check direct supervisor assignment
    if (user.assigned_to_supervisor) {
      const supervisor = users.find(u => u.id === user.assigned_to_supervisor)
      if (supervisor && (supervisor.role === 'supervisor' || supervisor.role === 'admin')) {
        return supervisor
      }
    }
    
    // Check admin assignment (admins can also supervise)
    if (user.assigned_to_admin) {
      const admin = users.find(u => u.id === user.assigned_to_admin)
      if (admin && admin.role === 'admin') {
        return admin
      }
    }

    return null
  }

  // Helper function to find a user's manager
  const getUserManager = (userId: string, userRole: UserRole): Profile | null => {
    const user = users.find(u => u.id === userId)
    if (!user) return null
    
    // Check direct manager assignment
    if (user.assigned_to_manager) {
      const manager = users.find(u => u.id === user.assigned_to_manager)
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
      'admin@test.com': 'Test Admin',
      'manager@test.com': 'Test Manager',
      'user@test.com': 'Test User'
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
    console.log('getAssignedUsers - Roles check:', {
      userRoleProp: userRole,
      currentUserProfileRole: currentUserProfile.role,
      currentUserEmail: currentUserProfile.email
    })

    if (userRole === 'admin') {
      return allUsers // Admins see all users
    }

    if (userRole === 'supervisor') {
      // Supervisors see users assigned to them
      const visibleUsers: Profile[] = []

      allUsers.forEach(user => {
        if (user.assigned_to_supervisor === currentUserProfile.id) {
          visibleUsers.push(user)
        }
      })

      return visibleUsers
    }

    if (userRole === 'manager') {
      // Managers see users assigned to them
      const visibleUsers: Profile[] = []

      allUsers.forEach(user => {
        if (user.assigned_to_manager === currentUserProfile.id) {
          visibleUsers.push(user)
        }
      })

      return visibleUsers
    }

    // Users see no other users
    return []
  }

  const fetchUsers = async () => {
    console.log('🔄 fetchUsers called - refreshing user data')
    setLoading(true)
    try {
      // In dev mode, create some mock users for testing
      const devMode = process.env.NODE_ENV === 'development'
      if (devMode && !currentUser) {
        const mockUsers: Profile[] = [
          {
            id: 'dev-admin',
            email: 'admin@test.com',
            display_name: 'Test Admin',
            role: 'admin',
            avatar_url: null,
            assigned_to_admin: null,
            assigned_to_supervisor: null,
            assigned_to_manager: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'dev-manager',
            email: 'manager@test.com',
            display_name: 'Test Manager',
            role: 'manager',
            avatar_url: null,
            assigned_to_admin: null,
            assigned_to_supervisor: null,
            assigned_to_manager: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'dev-user',
            email: 'user@test.com',
            display_name: 'Test User',
            role: 'user',
            avatar_url: null,
            assigned_to_admin: null,
            assigned_to_supervisor: null,
            assigned_to_manager: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        
        // Apply role-based filtering
        if (currentUser) {
          const filteredUsers = getAssignedUsers(currentUser, mockUsers)
          setUsers(filteredUsers)
        } else {
          setUsers(mockUsers)
        }
        
        setLoading(false)
        return
      }

      // Fetch from Supabase with assignment fields
      const { data, error } = await supabase
        .from('profiles')
        .select('*, assigned_to_admin, assigned_to_supervisor, assigned_to_manager, assigned_at, assigned_by')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching users:', error)
        setUsers([])
      } else {
        console.log(`📊 Fetched ${data?.length || 0} users from Supabase`)
        console.log('🔍 User data with assignments:', data?.map(u => ({
          email: u.email,
          assigned_to_admin: u.assigned_to_admin,
          assigned_to_supervisor: u.assigned_to_supervisor,
          assigned_to_manager: u.assigned_to_manager
        })))
        
        // Log users that have assignments
        const usersWithAssignments = data?.filter(u => 
          u.assigned_to_admin || u.assigned_to_supervisor || u.assigned_to_manager
        )
        console.log(`🎯 Found ${usersWithAssignments?.length || 0} users with assignments:`, usersWithAssignments?.map(u => ({
          email: u.email,
          admin: u.assigned_to_admin,
          supervisor: u.assigned_to_supervisor,
          manager: u.assigned_to_manager
        })))
        
        const allUsers = data || []

        // Apply role-based filtering
        if (currentUser) {
          const filteredUsers = getAssignedUsers(currentUser, allUsers)
          setUsers(filteredUsers)
        } else {
          setUsers(allUsers)
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    console.log(`🔄 Attempting to update user ${userId} role to ${newRole}`)
    setUpdatingRole(true)
    try {
      // In dev mode, just update local state
      const devMode = process.env.NODE_ENV === 'development'
      if (devMode) {
        setUsers(users.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        ))
        setUpdatingRole(false)
        return
      }

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
      }
    } catch (error) {
      console.error('❌ Error updating user role:', error)
      alert('Failed to update user role')
    } finally {
      setUpdatingRole(false)
    }
  }

  // Open manage modal for a user
  const openManageModal = (user: ExtendedProfile) => {
    setSelectedUser(user)
    setSelectedRole('manager')
    setSelectedAssignor(null)
    setSearchTerm('')
    setShowManageModal(true)
  }

  // Close manage modal
  const closeManageModal = () => {
    setShowManageModal(false)
    setSelectedUser(null)
    setSelectedAssignor(null)
    setSearchTerm('')
  }

  // Get available assignors based on selected role
  const getAvailableAssignors = () => {
    return users.filter(user => 
      user.role === selectedRole && 
      user.id !== selectedUser?.id &&
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // Check if user is currently assigned to someone with the selected role
  const getCurrentAssignment = () => {
    if (!selectedUser) return null
    
    const fieldMap = {
      'manager': 'assigned_to_manager',
      'supervisor': 'assigned_to_supervisor', 
      'admin': 'assigned_to_admin'
    }
    
    const assignedId = selectedUser[fieldMap[selectedRole] as keyof ExtendedProfile]
    if (!assignedId) return null
    
    return users.find(u => u.id === assignedId)
  }

  // Assign user to selected assignor
  const handleAssign = async () => {
    if (!selectedUser || !selectedAssignor) return
    
    const fieldMap = {
      'manager': 'assigned_to_manager',
      'supervisor': 'assigned_to_supervisor',
      'admin': 'assigned_to_admin'
    }
    
    await createAssignment(selectedUser.id, selectedAssignor.id, fieldMap[selectedRole])
    closeManageModal()
  }

  // Unassign user from current assignment
  const handleUnassign = async () => {
    if (!selectedUser) return
    
    const fieldMap = {
      'manager': 'assigned_to_manager',
      'supervisor': 'assigned_to_supervisor',
      'admin': 'assigned_to_admin'
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [fieldMap[selectedRole]]: null })
        .eq('id', selectedUser.id)
        
      if (error) throw error
      
      await fetchUsers()
      closeManageModal()
    } catch (error: any) {
      setError(`Failed to unassign: ${error.message}`)
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
              {users.length} {userRole === 'manager' ? 'assigned' : 'total'} users
            </span>
            {userRole === 'manager' && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">                                                                                                       Manager View: Assigned Users Only
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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"                   />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"                          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="manager">Managers</option>
            <option value="supervisor">Supervisors</option>
            <option value="admin">Admins</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"                          >
            <option value="created_at">Sort by Date</option>
            <option value="display_name">Sort by Name</option>
            <option value="email">Sort by Email</option>
            <option value="role">Sort by Role</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"                                      >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Supervisor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Manager
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">                                                                                                    Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">     
            {sortedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {/* Name column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {getDisplayNameForUser(user)}
                    {getUserAssignments(user.id).length > 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">                                                            📎 {getUserAssignments(user.id).length} assignment{getUserAssignments(user.id).length !== 1 ? 's' : ''}                                                                                                           </span>
                    )}
                  </div>
                </td>
                {/* Email column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                </td>
                {/* Role column - dropdown for admins, static for others */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {userRole === 'admin' ? (
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                      disabled={updatingRole}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[120px]"                                                           >
                      {getAssignableRoles(userRole).map(role => (
                        <option key={role} value={role}>
                          {getRoleDisplay(role).icon} {getRoleDisplay(role).label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>                                                                                                {getRoleDisplay(user.role).icon} {getRoleDisplay(user.role).label}
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
                    {canAssignUser(user.role) && (
                      <button
                        onClick={() => {
                          setSelectedAssignee(user)
                          setShowAssignModal(true)
                        }}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"                                                                                                                 >
                        Assign
                      </button>
                    )}
                    {getUserAssignments(user.id).length > 0 && (
                      <button
                        onClick={() => {
                          const assignment = getUserAssignments(user.id)[0]
                          if (assignment && confirm('Remove this assignment?')) {
                            removeAssignment(assignment.id, assignment.type as 'admin' | 'supervisor' | 'manager')
                          }
                        }}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Unassign
                      </button>
                    )}
                    <button
                      onClick={() => openManageModal(user)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Manage
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedUsers.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />                 </svg>
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"                   >
                <option value="">Select a {userRole === 'admin' ? 'supervisor/manager' : 'manager'}</option>                                                                                                                        {getAssignableTargets(selectedAssignee.role).map((target) => (
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
                    createAssignment(selectedAssignee.id, assignToUser, userRole === 'admin' ? 'assigned_to_supervisor' : 'assigned_to_manager')
                  }
                }}
                disabled={!assignToUser || assigning}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"                                                                                  >
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

      {/* Manage Modal */}
      {showManageModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Manage Assignments
                </h3>
                <button
                  onClick={closeManageModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div
              
              {/* User Name */}
              <div className="mt-2">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedUser.email}
                </p>
                {selectedUser.first_name && selectedUser.last_name && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </p>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getRoleColor(selectedUser.role)}`}>
                  {selectedUser.role}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              {/* Role Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Assign to Role:
                </label>
                <div className="space-y-2">
                  {(['manager', 'supervisor', 'admin'] as const).map((role) => (
                    <label key={role} className="flex items-center">
                      <input
                        type="radio"
                        name="assignRole"
                        value={role}
                        checked={selectedRole === role}
                        onChange={(e) => {
                          setSelectedRole(e.target.value as 'manager' | 'supervisor' | 'admin')
                          setSelectedAssignor(null)
                        }}
                        className="mr-2 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search {selectedRole}s:
                </label>
                <input
                  type="text"
                  placeholder={`Search for ${selectedRole}s...`}
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Current Assignment Display */}
              {getCurrentAssignment() && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-md">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Currently assigned to:
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {getCurrentAssignment()?.email} ({selectedRole})
                  </p>
                </div>
              )}

              {/* Available Assignors List */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Available {selectedRole}s:
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                  {getAvailableAssignors().length === 0 ? (
                    <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                      No {selectedRole}s found
                    </div>
                  ) : (
                    getAvailableAssignors().map((assignor) => (
                      <div
                        key={assignor.id}
                        onClick={() => setSelectedAssignor(assignor)}
                        className={`p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          selectedAssignor?.id === assignor.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {assignor.email}
                        </div>
                        {assignor.first_name && assignor.last_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {assignor.first_name} {assignor.last_name}
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              {getCurrentAssignment() && (
                <button
                  onClick={handleUnassign}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Unassign from {selectedRole}
                </button>
              )}
              
              <button
                onClick={handleAssign}
                disabled={!selectedAssignor}
                className={`flex-1 py-2 px-4 rounded-md focus:ring-2 focus:ring-offset-2 ${
                  selectedAssignor
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                }`}
              >
                Assign to {selectedRole}
              </button>
              
              <button
                onClick={closeManageModal}
                className="py-2 px-4 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
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
