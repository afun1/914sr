'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, UserAssignment } from '@/types/supabase'

interface HierarchyProps {
  userRole: string
}

export default function Hierarchy({ userRole }: HierarchyProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [effectiveRole, setEffectiveRole] = useState<string>(userRole)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)

  // Check for impersonation and get effective role
  useEffect(() => {
    const checkImpersonation = () => {
      const impersonationActive = localStorage.getItem('impersonation_active')
      const impersonatedUserData = localStorage.getItem('impersonation_target')
      
      if (impersonationActive === 'true' && impersonatedUserData) {
        const impersonated = JSON.parse(impersonatedUserData)
        setImpersonatedUser(impersonated)
        setEffectiveRole(impersonated.role)
        console.log('🎭 Impersonation detected in Hierarchy:', {
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
    fetchData()
    
    // Listen for assignment updates from UserManagement component
    const handleAssignmentUpdate = () => {
      console.log('📊 Hierarchy: Received assignment update event, refreshing...')
      fetchData()
    }
    
    window.addEventListener('userAssignmentUpdated', handleAssignmentUpdate)
    return () => window.removeEventListener('userAssignmentUpdated', handleAssignmentUpdate)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch real users from Supabase with assignment fields
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) {
        console.error('Error fetching users:', usersError)
      } else {
        console.log('Hierarchy - Fetched users:', usersData?.length)
        console.log('Hierarchy - Role distribution:', usersData?.reduce((acc, user) => {
          acc[user.role || 'null'] = (acc[user.role || 'null'] || 0) + 1
          return acc
        }, {} as Record<string, number>))
        console.log('Hierarchy - Assignment summary:', {
          assignedToAdmin: usersData?.filter(u => u.assigned_to_admin).length || 0,
          assignedToSupervisor: usersData?.filter(u => u.assigned_to_supervisor).length || 0,
          assignedToManager: usersData?.filter(u => u.assigned_to_manager).length || 0
        })
        setUsers(usersData || [])
      }
    } catch (error) {
      console.error('Error fetching hierarchy data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (userId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedNodes(newExpanded)
  }

  const getAssignedUsers = (supervisorId: string, targetRole: string): Profile[] => {
    // Get users assigned to this supervisor based on assignment fields in profiles table
    return users.filter(user => {
      if (user.role !== targetRole) return false
      
      // Check assignment based on the supervisor's role and user's assignment fields
      const supervisor = users.find(u => u.id === supervisorId)
      if (!supervisor) return false
      
      switch (supervisor.role) {
        case 'admin':
          return user.assigned_to_admin === supervisorId
        case 'supervisor':
          return user.assigned_to_supervisor === supervisorId
        case 'manager':
          return user.assigned_to_manager === supervisorId
        default:
          return false
      }
    })
  }

  const getDisplayName = (user: Profile): string => {
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

  const getRoleIcon = (role: string): string => {
    switch (role) {
      case 'admin': return '👑'
      case 'supervisor': return '📋'
      case 'manager': return '📊'
      case 'user': return '👤'
      default: return '❓'
    }
  }

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin': return 'text-purple-600 dark:text-purple-400'
      case 'supervisor': return 'text-blue-600 dark:text-blue-400'
      case 'manager': return 'text-green-600 dark:text-green-400'
      case 'user': return 'text-gray-600 dark:text-gray-400'
      default: return 'text-gray-500'
    }
  }

  const renderUserNode = (user: Profile, level: number = 0, isLast: boolean = false) => {
    const isExpanded = expandedNodes.has(user.id)
    
    // Get assigned users based on the user's role
    let assignedUsers: Profile[] = []
    if (user.role === 'admin') {
      // Admins can have assigned supervisors, managers, and users
      const assignedSupervisors = getAssignedUsers(user.id, 'supervisor')
      const assignedManagers = getAssignedUsers(user.id, 'manager')
      const assignedDirectUsers = getAssignedUsers(user.id, 'user')
      assignedUsers = [...assignedSupervisors, ...assignedManagers, ...assignedDirectUsers]
    } else if (user.role === 'supervisor') {
      // Supervisors can have assigned managers and users
      const assignedManagers = getAssignedUsers(user.id, 'manager')
      const assignedDirectUsers = getAssignedUsers(user.id, 'user')
      assignedUsers = [...assignedManagers, ...assignedDirectUsers]
    } else if (user.role === 'manager') {
      // Managers can have assigned users
      assignedUsers = getAssignedUsers(user.id, 'user')
    }
    
    const hasChildren = assignedUsers.length > 0

    const indentStyle = {
      paddingLeft: `${level * 24}px`
    }

    return (
      <div key={user.id} className="border-l-2 border-gray-200 dark:border-gray-600">
        <div 
          className="flex items-center py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-700"
          style={indentStyle}
        >
          {hasChildren && (
            <button 
              className="mr-3 w-6 h-6 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-bold transition-colors shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(user.id)
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
          {!hasChildren && <span className="mr-9"></span>}
          
          <span className="mr-2">{getRoleIcon(user.role)}</span>
          <button
            onClick={() => {
              setSelectedUser(user)
              setShowUserModal(true)
            }}
            className={`font-medium ${getRoleColor(user.role)} hover:underline cursor-pointer`}
          >
            {getDisplayName(user)}
          </button>
          <span className="ml-2 text-sm text-gray-500">
            ({user.email})
          </span>
          <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {user.role}
          </span>
          
          {hasChildren && (
            <span className="ml-auto text-xs text-gray-400">
              {assignedUsers.length} assigned
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div className="ml-4">
            {user.role === 'admin' && (
              <>
                {/* Show assigned supervisors */}
                {(() => {
                  const assignedSupervisors = getAssignedUsers(user.id, 'supervisor')
                  return assignedSupervisors.length > 0 && (
                    <div>
                      <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                        📋 Supervisors
                      </div>
                      {assignedSupervisors.map((supervisor, index) => (
                        <div key={supervisor.id}>
                          {renderUserNode(supervisor, level + 1, index === assignedSupervisors.length - 1)}
                        </div>
                      ))}
                    </div>
                  )
                })()}
                
                {/* Show assigned managers (direct to admin) */}
                {(() => {
                  const assignedManagers = getAssignedUsers(user.id, 'manager')
                  return assignedManagers.length > 0 && (
                    <div>
                      <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                        📊 Managers
                      </div>
                      {assignedManagers.map((manager, index) => (
                        <div key={manager.id}>
                          {renderUserNode(manager, level + 1, index === assignedManagers.length - 1)}
                        </div>
                      ))}
                    </div>
                  )
                })()}
                
                {/* Show assigned users (direct to admin) */}
                {(() => {
                  const assignedDirectUsers = getAssignedUsers(user.id, 'user')
                  return assignedDirectUsers.length > 0 && (
                    <div>
                      <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                        👤 Direct Users
                      </div>
                      {assignedDirectUsers.map((assignedUser, index) => 
                        renderUserNode(assignedUser, level + 1, index === assignedDirectUsers.length - 1)
                      )}
                    </div>
                  )
                })()}
              </>
            )}
            
            {user.role === 'supervisor' && (
              <>
                {/* Show assigned managers */}
                {(() => {
                  const assignedManagers = getAssignedUsers(user.id, 'manager')
                  return assignedManagers.length > 0 && (
                    <div>
                      <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                        📊 Managers
                      </div>
                      {assignedManagers.map((manager, index) => (
                        <div key={manager.id}>
                          {renderUserNode(manager, level + 1, index === assignedManagers.length - 1)}
                        </div>
                      ))}
                    </div>
                  )
                })()}
                
                {/* Show assigned users (direct to supervisor) */}
                {(() => {
                  const assignedDirectUsers = getAssignedUsers(user.id, 'user')
                  return assignedDirectUsers.length > 0 && (
                    <div>
                      <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                        👤 Direct Users
                      </div>
                      {assignedDirectUsers.map((assignedUser, index) => 
                        renderUserNode(assignedUser, level + 1, index === assignedDirectUsers.length - 1)
                      )}
                    </div>
                  )
                })()}
              </>
            )}
            
            {user.role === 'manager' && (
              <>
                {/* Show assigned users */}
                {(() => {
                  const assignedDirectUsers = getAssignedUsers(user.id, 'user')
                  return assignedDirectUsers.length > 0 && (
                    <div>
                      <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                        👤 Users
                      </div>
                      {assignedDirectUsers.map((assignedUser, index) => 
                        renderUserNode(assignedUser, level + 1, index === assignedDirectUsers.length - 1)
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading hierarchy...</span>
      </div>
    )
  }

  const admins = users.filter(u => u.role === 'admin')
  const supervisors = users.filter(u => u.role === 'supervisor')
  const managers = users.filter(u => u.role === 'manager')
  const regularUsers = users.filter(u => u.role === 'user')
  const unknownRoles = users.filter(u => !u.role || !['admin', 'supervisor', 'manager', 'user'].includes(u.role))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          📊 Organization Hierarchy
        </h2>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Admins Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 flex items-center">
              👑 Admins ({admins.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {admins.map(admin => renderUserNode(admin))}
          </div>
        </div>

        {/* Supervisors Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 flex items-center">
              📋 Supervisors ({supervisors.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {supervisors.map(supervisor => renderUserNode(supervisor))}
          </div>
        </div>

        {/* Managers Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 flex items-center">
              📊 Managers ({managers.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {managers.map(manager => renderUserNode(manager))}
          </div>
        </div>

        {/* Users Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
              👤 Users ({regularUsers.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {regularUsers.map(user => renderUserNode(user))}
          </div>
        </div>

        {/* Unknown Roles Section (for debugging) */}
        {unknownRoles.length > 0 && (
          <div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 flex items-center">
                ❓ Unknown Roles ({unknownRoles.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {unknownRoles.map(user => renderUserNode(user))}
            </div>
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No hierarchy data available
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{getRoleIcon(selectedUser.role)}</span>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {getDisplayName(selectedUser)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedUser.email}
                  </p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                    selectedUser.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                    selectedUser.role === 'supervisor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    selectedUser.role === 'manager' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }`}>
                    {selectedUser.role?.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setSelectedUser(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Assignment Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Assignment Information
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                  {selectedUser.assigned_to_admin && (
                    <div className="flex items-center space-x-3">
                      <span className="text-purple-600">👑</span>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned to Admin:</span>
                        <p className="text-gray-900 dark:text-white">
                          {(() => {
                            const admin = users.find(u => u.id === selectedUser.assigned_to_admin)
                            return admin ? getDisplayName(admin) : 'Unknown Admin'
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedUser.assigned_to_supervisor && (
                    <div className="flex items-center space-x-3">
                      <span className="text-blue-600">📋</span>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned to Supervisor:</span>
                        <p className="text-gray-900 dark:text-white">
                          {(() => {
                            const supervisor = users.find(u => u.id === selectedUser.assigned_to_supervisor)
                            return supervisor ? getDisplayName(supervisor) : 'Unknown Supervisor'
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedUser.assigned_to_manager && (
                    <div className="flex items-center space-x-3">
                      <span className="text-green-600">📊</span>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned to Manager:</span>
                        <p className="text-gray-900 dark:text-white">
                          {(() => {
                            const manager = users.find(u => u.id === selectedUser.assigned_to_manager)
                            return manager ? getDisplayName(manager) : 'Unknown Manager'
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {!selectedUser.assigned_to_admin && !selectedUser.assigned_to_supervisor && !selectedUser.assigned_to_manager && (
                    <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                      <span>⚠️</span>
                      <span className="text-sm">Not assigned to anyone</span>
                    </div>
                  )}
                </div>
              </div>

              {/* People Assigned to This User */}
              {(selectedUser.role === 'admin' || selectedUser.role === 'supervisor' || selectedUser.role === 'manager') && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    People Assigned to {getDisplayName(selectedUser)}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    {(() => {
                      const assignedPeople = []
                      
                      if (selectedUser.role === 'admin') {
                        const assignedSupervisors = getAssignedUsers(selectedUser.id, 'supervisor')
                        const assignedManagers = getAssignedUsers(selectedUser.id, 'manager')
                        const assignedUsers = getAssignedUsers(selectedUser.id, 'user')
                        assignedPeople.push(...assignedSupervisors, ...assignedManagers, ...assignedUsers)
                      } else if (selectedUser.role === 'supervisor') {
                        const assignedManagers = getAssignedUsers(selectedUser.id, 'manager')
                        const assignedUsers = getAssignedUsers(selectedUser.id, 'user')
                        assignedPeople.push(...assignedManagers, ...assignedUsers)
                      } else if (selectedUser.role === 'manager') {
                        const assignedUsers = getAssignedUsers(selectedUser.id, 'user')
                        assignedPeople.push(...assignedUsers)
                      }
                      
                      if (assignedPeople.length === 0) {
                        return (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            No one is assigned to this {selectedUser.role}
                          </p>
                        )
                      }
                      
                      return (
                        <div className="space-y-2">
                          {assignedPeople.map(person => (
                            <div key={person.id} className="flex items-center space-x-3 p-2 bg-white dark:bg-gray-600 rounded">
                              <span>{getRoleIcon(person.role)}</span>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {getDisplayName(person)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {person.email} • {person.role}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Account Details */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Account Details
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">User ID:</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedUser.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Created:</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                  {selectedUser.assigned_at && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Assigned:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(selectedUser.assigned_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setSelectedUser(null)
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
