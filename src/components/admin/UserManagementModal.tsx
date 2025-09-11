'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/supabase'

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

export default function UserManagementModal() {
  const [users, setUsers] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  
  // Modal state management  
  const [showManageModal, setShowManageModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState<'manager' | 'supervisor' | 'admin'>('manager')
  const [selectedAssignor, setSelectedAssignor] = useState<Profile | null>(null)
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [showPromoteDropdown, setShowPromoteDropdown] = useState(false)
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('user')
  const [showAddFolderModal, setShowAddFolderModal] = useState(false)
  const [folderSearchTerm, setFolderSearchTerm] = useState('')
  const [selectedUserForFolder, setSelectedUserForFolder] = useState<Profile | null>(null)
  const [isDropdownOpenFolder, setIsDropdownOpenFolder] = useState(false)

  useEffect(() => {
    fetchUsers()
    getCurrentUser()
  }, [])

  // Debug effect to log role changes
  useEffect(() => {
    console.log('🎯 UserManagementModal - userRole changed to:', userRole)
    console.log('🎯 UserManagementModal - currentUser email:', currentUser?.email)
  }, [userRole, currentUser])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    
    // Get current user's profile to check role
    if (user) {
      // Special handling for john@tpnlife.com - always admin
      if (user.email === 'john@tpnlife.com') {
        setUserRole('admin')
        return
      }
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('Error fetching profile:', error)
        return
      }
      
      if (profile) {
        setUserRole(profile.role)
      }
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  // Open manage modal for a user
  const openManageModal = (user: Profile) => {
    setSelectedUser(user)
    setSelectedRole('manager')
    setSelectedAssignor(null)
    setModalSearchTerm('')
    setIsDropdownOpen(false)
    setShowManageModal(true)
  }

  // Close manage modal
  const closeManageModal = () => {
    setShowManageModal(false)
    setSelectedUser(null)
    setSelectedAssignor(null)
    setModalSearchTerm('')
    setIsDropdownOpen(false)
  }

  // Get available assignors based on selected role
  const getAvailableAssignors = () => {
    return users.filter(user => 
      user.role === selectedRole && 
      user.id !== selectedUser?.id &&
      (user.email?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
      `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(modalSearchTerm.toLowerCase()))
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
    
    const assignedId = (selectedUser as any)[fieldMap[selectedRole]]
    if (!assignedId) return null
    
    return users.find(u => u.id === assignedId)
  }

  // Get user's assigned manager
  const getUserManager = (user: Profile) => {
    if (!user.assigned_to_manager) return null
    return users.find(u => u.id === user.assigned_to_manager)
  }

  // Get user's assigned supervisor (either direct or through manager)
  const getUserSupervisor = (user: Profile) => {
    // First check if user is directly assigned to a supervisor
    if (user.assigned_to_supervisor) {
      return users.find(u => u.id === user.assigned_to_supervisor)
    }
    
    // If user has a manager, get the manager's supervisor
    const manager = getUserManager(user)
    if (manager && manager.assigned_to_supervisor) {
      return users.find(u => u.id === manager.assigned_to_supervisor)
    }
    
    return null
  }

  // Create assignment in both assignments table and profiles table
  const createAssignment = async (assigneeId: string, assignorId: string, field: string) => {
    try {
      const assignee = users.find(u => u.id === assigneeId)
      const assignor = users.find(u => u.id === assignorId)

      if (!assignee || !assignor) {
        throw new Error('Invalid user selection')
      }

      // 1. Insert into assignments table
      const { error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          assignee_id: assigneeId,
          assignor_id: assignorId,
          assignee_role: assignee.role,
          assignor_role: assignor.role
        })

      if (assignmentError) {
        console.error('Assignment table error:', assignmentError)
        throw assignmentError
      }

      // 2. Update profiles table
      const updateData: any = {}
      updateData[field] = assignorId
      updateData.assigned_by = currentUser?.id
      updateData.assigned_at = new Date().toISOString()

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', assigneeId)

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw profileError
      }

      await fetchUsers()
    } catch (error: any) {
      console.error('Error creating assignment:', error)
      setError(`Failed to create assignment: ${error.message}`)
    }
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
      console.error('Failed to unassign:', error)
      setError(`Failed to unassign: ${error.message}`)
    }
  }

  // Handle bulk delete (admin only)
  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedUsers.size} selected user(s)? This action cannot be undone.`
    )
    
    if (!confirmDelete) return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', Array.from(selectedUsers))
      
      if (error) throw error
      
      setSelectedUsers(new Set())
      await fetchUsers()
    } catch (error: any) {
      console.error('Error deleting users:', error)
      setError(`Failed to delete users: ${error.message}`)
    }
  }
  const handleUserSelect = (userId: string) => {
    const newSelectedUsers = new Set(selectedUsers)
    if (newSelectedUsers.has(userId)) {
      newSelectedUsers.delete(userId)
    } else {
      newSelectedUsers.add(userId)
    }
    setSelectedUsers(newSelectedUsers)
  }

  // Handle impersonation
  const handleImpersonate = async (user: Profile) => {
    try {
      // Implementation for impersonation would go here
      // This would likely involve admin functions to sign in as another user
      console.log('Impersonating user:', user.email)
      alert(`Impersonation feature for ${user.display_name || user.email} would be implemented here`)
    } catch (error) {
      console.error('Error impersonating user:', error)
    }
  }

  // Handle role promotion
  const handlePromoteUser = async () => {
    if (!selectedUser || !selectedNewRole) return
    
    const confirmPromote = window.confirm(
      `Are you sure you want to change ${selectedUser.display_name || selectedUser.email}'s role to ${selectedNewRole}?`
    )
    
    if (!confirmPromote) return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: selectedNewRole })
        .eq('id', selectedUser.id)
      
      if (error) throw error
      
      await fetchUsers()
      setShowPromoteDropdown(false)
      closeManageModal()
    } catch (error: any) {
      console.error('Error promoting user:', error)
      setError(`Failed to promote user: ${error.message}`)
    }
  }

  // Handle creating folder for selected user
  const handleCreateFolder = async () => {
    if (!selectedUserForFolder) return
    
    try {
      const response = await fetch('/api/folders/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user-folder',
          userEmail: selectedUserForFolder.email,
          displayName: selectedUserForFolder.display_name || selectedUserForFolder.email?.split('@')[0]
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ Folder created successfully! 

User: ${selectedUserForFolder.display_name || selectedUserForFolder.email}
Videos imported: ${result.videosImported || 0}

They can now see their videos in "Your Recordings"!`)
        setShowAddFolderModal(false)
        setSelectedUserForFolder(null)
        setFolderSearchTerm('')
      } else {
        alert(`❌ Error creating folder: ${result.error}`)
      }
      
    } catch (error) {
      console.error('Error creating folder:', error)
      alert('Failed to create folder')
    }
  }

  // Get users for folder creation dropdown
  const getAvailableUsersForFolder = () => {
    return users.filter(user => 
      user.email?.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
      `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(folderSearchTerm.toLowerCase())
    )
  }

  const getRoleColor = (role: UserRole) => {
    const colors = {
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      supervisor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      user: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    }
    return colors[role] || colors.user
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error}
          <button 
            onClick={() => setError(null)}
            className="float-right text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        {/* Table Header with Delete Button */}
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Manage user assignments and roles
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Debug info to check admin status */}
            <div className="text-xs text-gray-500">
              Role: "{userRole}" | Email: {currentUser?.email} | IsJohn: {currentUser?.email === 'john@tpnlife.com' ? 'YES' : 'NO'}
            </div>
            
            {/* Add Folder Button - Show if admin OR if john@tpnlife.com */}
            {(userRole === 'admin' || currentUser?.email === 'john@tpnlife.com') ? (
              <button
                onClick={() => setShowAddFolderModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Folder
              </button>
            ) : (
              <div className="text-xs text-red-500">
                Button hidden - Role: "{userRole}", Email: {currentUser?.email}
              </div>
            )}
            
            {/* Admin-only Delete Button */}
            {(userRole === 'admin' || currentUser?.email === 'john@tpnlife.com') && selectedUsers.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete ({selectedUsers.size})
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      disabled
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-50 cursor-not-allowed"
                      title="Select All disabled"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Manager
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Supervisor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sign In As
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {/* Column 1: Select */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleUserSelect(user.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    
                    {/* Column 2: Display Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.display_name || user.email}
                      </div>
                      {user.first_name && user.last_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {user.first_name} {user.last_name}
                        </div>
                      )}
                    </td>
                    
                    {/* Column 3: Email */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {user.email}
                      </div>
                    </td>
                    
                    {/* Column 4: Manager */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getUserManager(user) ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getUserManager(user)?.display_name || getUserManager(user)?.email}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                          Unassigned
                        </div>
                      )}
                    </td>
                    
                    {/* Column 5: Supervisor */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getUserSupervisor(user) ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getUserSupervisor(user)?.display_name || getUserSupervisor(user)?.email}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                          Unassigned
                        </div>
                      )}
                    </td>
                    
                    {/* Column 6: Role */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    
                    {/* Column 7: Impersonation */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleImpersonate(user)}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                        title={`Sign in as ${user.display_name || user.email}`}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </button>
                    </td>
                    
                    {/* Column 8: Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openManageModal(user)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Management Modal */}
      {showManageModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {/* User Display Name */}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedUser.display_name || selectedUser.email}
                  </h3>
                  {selectedUser.display_name && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedUser.email}
                    </p>
                  )}
                  {selectedUser.first_name && selectedUser.last_name && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${getRoleColor(selectedUser.role)}`}>
                    {selectedUser.role}
                  </span>
                </div>
                <button
                  onClick={closeManageModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              {/* Role Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Assign to Role:
                </label>
                <div className="flex gap-6">
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
                          setModalSearchTerm('')
                          setIsDropdownOpen(false)
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

              {/* Search with Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search and Select {selectedRole}:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Search for ${selectedRole}s or select from list...`}
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => {
                      // Delay closing to allow clicks on dropdown items
                      setTimeout(() => setIsDropdownOpen(false), 150)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  
                  {/* Dropdown Results - Show when dropdown is open and no user selected */}
                  {isDropdownOpen && !selectedAssignor && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {getAvailableAssignors().length === 0 ? (
                        <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                          {modalSearchTerm ? 
                            `No ${selectedRole}s found matching "${modalSearchTerm}"` :
                            `No ${selectedRole}s available`
                          }
                        </div>
                      ) : (
                        getAvailableAssignors().map((assignor) => (
                          <div
                            key={assignor.id}
                            onClick={() => {
                              setSelectedAssignor(assignor)
                              setModalSearchTerm(assignor.email || '')
                              setIsDropdownOpen(false)
                            }}
                            className="p-3 cursor-pointer border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 last:border-b-0"
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
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected User Display */}
                {selectedAssignor && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900 rounded-md">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Selected {selectedRole}:
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {selectedAssignor.email}
                      {selectedAssignor.first_name && selectedAssignor.last_name && (
                        <span className="ml-1">
                          ({selectedAssignor.first_name} {selectedAssignor.last_name})
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedAssignor(null)
                        setModalSearchTerm('')
                        setIsDropdownOpen(false)
                      }}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 mt-1"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              {/* Promote Section */}
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Change Role:
                  </label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handlePromoteUser}
                    disabled={selectedNewRole === selectedUser?.role}
                    className={`py-1 px-3 rounded-md text-sm focus:ring-2 focus:ring-offset-2 ${
                      selectedNewRole !== selectedUser?.role
                        ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Promote
                  </button>
                </div>
              </div>
              
              {/* Assignment Buttons */}
              <div className="flex gap-3">
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
        </div>
      )}

      {/* Add Folder Modal - Admin only */}
      {showAddFolderModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Create User Folder
                </h3>
                <button
                  onClick={() => {
                    setShowAddFolderModal(false)
                    setSelectedUserForFolder(null)
                    setFolderSearchTerm('')
                    setIsDropdownOpenFolder(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a user to create a folder for their videos in the folder manager.
              </p>

              {/* User Search with Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search for User:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={folderSearchTerm}
                    onChange={(e) => setFolderSearchTerm(e.target.value)}
                    onFocus={() => setIsDropdownOpenFolder(true)}
                    onBlur={() => {
                      setTimeout(() => setIsDropdownOpenFolder(false), 150)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  
                  {/* Dropdown Results */}
                  {isDropdownOpenFolder && !selectedUserForFolder && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {getAvailableUsersForFolder().length === 0 ? (
                        <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                          {folderSearchTerm ? 
                            `No users found matching "${folderSearchTerm}"` :
                            `No users available`
                          }
                        </div>
                      ) : (
                        getAvailableUsersForFolder().map((user) => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setSelectedUserForFolder(user)
                              setFolderSearchTerm(user.display_name || user.email || '')
                              setIsDropdownOpenFolder(false)
                            }}
                            className="p-3 cursor-pointer border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.display_name || user.email}
                            </div>
                            {user.display_name && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.email}
                              </div>
                            )}
                            {user.first_name && user.last_name && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.first_name} {user.last_name}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected User Display */}
                {selectedUserForFolder && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900 rounded-md">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Selected User:
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {selectedUserForFolder.display_name || selectedUserForFolder.email}
                      {selectedUserForFolder.display_name && (
                        <span className="ml-1 text-xs">({selectedUserForFolder.email})</span>
                      )}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedUserForFolder(null)
                        setFolderSearchTerm('')
                      }}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 mt-1"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={handleCreateFolder}
                disabled={!selectedUserForFolder}
                className={`flex-1 py-2 px-4 rounded-md focus:ring-2 focus:ring-offset-2 ${
                  selectedUserForFolder
                    ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                }`}
              >
                Create Folder
              </button>
              
              <button
                onClick={() => {
                  setShowAddFolderModal(false)
                  setSelectedUserForFolder(null)
                  setFolderSearchTerm('')
                  setIsDropdownOpenFolder(false)
                }}
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