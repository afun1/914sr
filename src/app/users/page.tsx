'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GlobalHeader from '@/components/GlobalHeader'

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    role: ''
  })
  const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set())
  const [updatingUser, setUpdatingUser] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  // Add impersonation handler
  const handleImpersonateUser = async (targetUser: any) => {
    if (!confirm(`🚨 DANGER: Are you sure you want to impersonate ${targetUser.email}? This will log you in as them!`)) {
      return
    }

    setImpersonating(true)
    
    try {
      console.log('🎭 Starting impersonation of:', targetUser.email)
      
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No valid session found')
      }
      
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: targetUser.id,
          targetUserEmail: targetUser.email,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('🎭 Impersonation successful:', result)
        
        if (result.impersonationLink) {
          // Store impersonation state before redirect
          localStorage.setItem('impersonation_data', JSON.stringify({
            originalUserId: currentUser?.id,
            originalUserEmail: currentUser?.email,
            targetUserId: targetUser.id,
            targetUserEmail: targetUser.email,
            timestamp: new Date().toISOString()
          }))
          
          // Force localhost redirect by modifying the URL
          let impersonationUrl = result.impersonationLink
          console.log('🔍 Original impersonation URL:', impersonationUrl)
          
          // Always modify the URL to point to localhost in development
          if (window.location.hostname === 'localhost') {
            try {
              const url = new URL(impersonationUrl)
              console.log('🔍 Original redirect_to:', url.searchParams.get('redirect_to'))
              
              // Force the redirect to localhost
              url.searchParams.set('redirect_to', `${window.location.origin}/users`)
              impersonationUrl = url.toString()
              console.log('🔧 Modified URL for localhost:', impersonationUrl)
            } catch (urlError) {
              console.warn('⚠️ Could not modify URL, using original:', urlError)
            }
          }
          
          // Redirect to the magic link to sign in as the target user
          console.log('🚀 Final URL:', impersonationUrl)
          alert(`🎭 Impersonation activated! Redirecting to sign in as ${targetUser.email}`)
          
          // For localhost, try opening in same window
          if (window.location.hostname === 'localhost') {
            window.location.href = impersonationUrl
          } else {
            // For production, use direct redirect
            window.location.href = impersonationUrl
          }
        } else {
          throw new Error('No impersonation link received')
        }
      } else {
        const error = await response.json()
        console.error('❌ Impersonation failed:', error)
        alert('Impersonation failed: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Error during impersonation:', error)
      alert('Error during impersonation: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setImpersonating(false)
    }
  }

  useEffect(() => {
    getCurrentUser()
    fetchUsers()
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      // Fetch user profile to get role
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (!error && profile) {
          setUserRole(profile.role)
          console.log('👤 User role:', profile.role)
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      console.log('🔄 Starting to fetch users...')
      
      // Try a simpler query first to see what columns exist
      const { data, error } = await supabase
        .from('profiles')
        .select('*')

      if (error) {
        console.error('❌ Supabase error fetching users:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        // Try alternative query without ordering
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, email, role, created_at, full_name')
        
        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError)
          return
        }
        
        console.log('✅ Fallback query succeeded:', fallbackData?.length || 0)
        setUsers(fallbackData || [])
        return
      }

      console.log('✅ Successfully fetched users:', data?.length || 0)
      console.log('👥 Users data:', data)
      setUsers(data || [])
    } catch (error) {
      console.error('❌ Unexpected error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = (user: any) => {
    setSelectedUser(user)
    setEditForm({
      role: user.role || 'user'
    })
    setShowEditModal(true)
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return

    setUpdatingUser(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editForm.role
        })
        .eq('id', selectedUser.id)

      if (error) {
        console.error('Error updating user:', error)
        alert('Failed to update user: ' + error.message)
        return
      }

      console.log('✅ User updated successfully')
      setShowEditModal(false)
      setSelectedUser(null)
      fetchUsers() // Refresh the users list
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Error updating user: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingUser(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingUsers(prev => new Set([...prev, userId]))

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) {
        console.error('Error deleting user:', error)
        alert('Failed to delete user: ' + error.message)
        return
      }

      console.log('✅ User deleted successfully')
      fetchUsers() // Refresh the users list
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setDeletingUsers(prev => {
        const updated = new Set(prev)
        updated.delete(userId)
        return updated
      })
    }
  }

  if (loading) {
    return (
      <>
        <GlobalHeader user={currentUser} />
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16 relative">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading users...</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <GlobalHeader user={currentUser} />
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16 relative">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            👥 Users
          </h1>

          {users.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No users found
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                No user profiles have been created yet.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {users.map((user: any) => (
              <div 
                key={user.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-200 relative group"
              >
                {/* Admin Controls - Only admins can edit/delete */}
                {userRole === 'admin' && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                    <button
                      onClick={() => handleImpersonateUser(user)}
                      disabled={impersonating}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white p-2 rounded-full shadow-lg transition-colors"
                      title="Impersonate User"
                    >
                      {impersonating ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                    {currentUser?.id !== user.id && (
                      <>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg"
                          title="Edit User"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.full_name || user.email)}
                          disabled={deletingUsers.has(user.id)}
                          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete User"
                        >
                          {deletingUsers.has(user.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
                
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {user.full_name || user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User'}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    {user.email}
                  </p>
                  
                  {user.role && (
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${
                      user.role === 'admin' 
                        ? 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'
                        : user.role === 'supervisor'
                        ? 'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200'
                        : user.role === 'manager'
                        ? 'bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                        : 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                    }`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditModal(false)
            setSelectedUser(null)
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit User
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  User
                </label>
                <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {selectedUser.display_name || selectedUser.full_name || 'No Name'}
                </div>
                <div className="text-md font-bold text-gray-600 dark:text-gray-400">
                  {selectedUser.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={updatingUser}
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                }}
                disabled={updatingUser}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updatingUser}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {updatingUser && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                )}
                {updatingUser ? 'Updating...' : 'Update User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}