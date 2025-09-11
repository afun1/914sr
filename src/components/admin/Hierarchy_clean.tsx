'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, UserAssignment } from '@/types/supabase'

interface HierarchyProps {
  userRole: string
}

export default function Hierarchy({ userRole }: HierarchyProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [assignments, setAssignments] = useState<UserAssignment[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [effectiveRole, setEffectiveRole] = useState<string>(userRole)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [selectedOrgUser, setSelectedOrgUser] = useState<Profile | null>(null)

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
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch users from database
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (profilesError) throw profilesError

      // Load assignments from localStorage (since this is view-only, we just read them)
      const savedAssignments = localStorage.getItem('userAssignments')
      const assignmentData = savedAssignments ? JSON.parse(savedAssignments) : []

      setUsers(profiles || [])
      setAssignments(assignmentData)

      console.log('📊 Hierarchy data loaded:', {
        users: profiles?.length || 0,
        assignments: assignmentData.length
      })
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
    const assignedUserIds = assignments
      .filter(a => a.assignor_id === supervisorId)
      .map(a => a.assignee_id)
    
    return users.filter(u => assignedUserIds.includes(u.id) && u.role === targetRole)
  }

  const getAllAssignedUsers = (supervisorId: string): Profile[] => {
    const assignedUserIds = assignments
      .filter(a => a.assignor_id === supervisorId)
      .map(a => a.assignee_id)
    
    return users.filter(u => assignedUserIds.includes(u.id))
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

  // Get organizational structure for a specific user
  const getOrganizationalStructure = (user: Profile) => {
    if (user.role === 'supervisor') {
      // For supervisors, show their managers and users
      const assignedManagers = getAssignedUsers(user.id, 'manager')
      const assignedUsers = getAssignedUsers(user.id, 'user')
      
      // Also get users assigned to their managers
      const allManagerUsers: Profile[] = []
      assignedManagers.forEach(manager => {
        const managerUsers = getAssignedUsers(manager.id, 'user')
        allManagerUsers.push(...managerUsers)
      })

      return {
        type: 'supervisor',
        supervisor: user,
        managers: assignedManagers,
        users: [...assignedUsers, ...allManagerUsers]
      }
    } else if (user.role === 'manager') {
      // For managers, show their supervisor, peer managers, and their users
      const supervisorAssignment = assignments.find(a => a.assignee_id === user.id)
      const supervisor = supervisorAssignment ? users.find(u => u.id === supervisorAssignment.assignor_id) : null
      const assignedUsers = getAssignedUsers(user.id, 'user')
      
      // Get peer managers under the same supervisor
      const peerManagers = supervisor ? getAssignedUsers(supervisor.id, 'manager').filter(m => m.id !== user.id) : []

      return {
        type: 'manager',
        manager: user,
        supervisor,
        peerManagers,
        users: assignedUsers
      }
    } else if (user.role === 'user') {
      // For users, show their manager, supervisor, and admin
      const managerAssignment = assignments.find(a => a.assignee_id === user.id)
      const manager = managerAssignment ? users.find(u => u.id === managerAssignment.assignor_id) : null
      
      // Find supervisor (either direct assignment or manager's supervisor)
      let supervisor = null
      if (manager) {
        const supervisorAssignment = assignments.find(a => a.assignee_id === manager.id)
        supervisor = supervisorAssignment ? users.find(u => u.id === supervisorAssignment.assignor_id) : null
      } else {
        // Check for direct supervisor assignment
        const directSupervisorAssignment = assignments.find(a => a.assignee_id === user.id && 
          users.find(u => u.id === a.assignor_id)?.role === 'supervisor')
        supervisor = directSupervisorAssignment ? users.find(u => u.id === directSupervisorAssignment.assignor_id) : null
      }

      return {
        type: 'user',
        user,
        manager,
        supervisor
      }
    } else if (user.role === 'admin') {
      // For admins, show the hierarchy of assignments they've made
      // Get supervisors assigned to this admin
      const assignedSupervisors = getAssignedUsers(user.id, 'supervisor')
      
      // Create a hierarchical structure for each supervisor
      const supervisorHierarchies = assignedSupervisors.map(supervisor => {
        const supervisorManagers = getAssignedUsers(supervisor.id, 'manager')
        const directSupervisorUsers = getAssignedUsers(supervisor.id, 'user')
        
        // Get users under each manager
        const managerHierarchies = supervisorManagers.map(manager => ({
          manager,
          users: getAssignedUsers(manager.id, 'user')
        }))

        return {
          supervisor,
          managers: managerHierarchies,
          directUsers: directSupervisorUsers // Users assigned directly to supervisor, not through a manager
        }
      })

      return {
        type: 'admin',
        admin: user,
        supervisorHierarchies
      }
    }

    return null
  }

  // Handle clicking on a user name to show organizational modal
  const handleUserClick = (user: Profile) => {
    setSelectedOrgUser(user)
    setShowOrgModal(true)
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
    const assignedManagers = getAssignedUsers(user.id, 'manager')
    const assignedUsers = getAssignedUsers(user.id, 'user')
    const hasChildren = assignedManagers.length > 0 || assignedUsers.length > 0

    const indentStyle = {
      paddingLeft: `${level * 24}px`
    }

    return (
      <div key={user.id}>
        <div 
          className="flex items-center py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
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
            className={`font-medium ${getRoleColor(user.role)} hover:underline cursor-pointer`}
            onClick={(e) => {
              e.stopPropagation()
              handleUserClick(user)
            }}
            title={`View ${getDisplayName(user)}'s organization`}
          >
            {getDisplayName(user)}
          </button>
          <span className="ml-2 text-sm text-gray-500">
            ({user.email})
          </span>
          <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {user.role}
          </span>
          
          {/* Show assignment count if there are children */}
          {hasChildren && (
            <span className="ml-auto text-xs text-gray-400">
              {assignedManagers.length + assignedUsers.length} assigned
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>
            {assignedManagers.length > 0 && (
              <div>
                <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                  📊 Managers
                </div>
                {assignedManagers.map((manager, index) => (
                  <div key={manager.id} className="relative">
                    {renderUserNode(manager, level + 1, index === assignedManagers.length - 1)}
                    {expandedNodes.has(manager.id) && (
                      <div className="ml-4">
                        {getAssignedUsers(manager.id, 'user').map((managedUser, userIndex) => {
                          const managedUsers = getAssignedUsers(manager.id, 'user')
                          return renderUserNode(managedUser, level + 2, userIndex === managedUsers.length - 1)
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {assignedUsers.length > 0 && (
              <div>
                <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                  👤 Direct Users
                </div>
                {assignedUsers.map((assignedUser, index) => (
                  <div key={assignedUser.id}>
                    {renderUserNode(assignedUser, level + 1, index === assignedUsers.length - 1)}
                  </div>
                ))}
              </div>
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
          {admins.map(admin => renderUserNode(admin))}
        </div>

        {/* Supervisors Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 flex items-center">
              📋 Supervisors ({supervisors.length})
            </h3>
          </div>
          {supervisors.map(supervisor => renderUserNode(supervisor))}
        </div>

        {/* Managers Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 flex items-center">
              📊 Managers ({managers.length})
            </h3>
          </div>
          {managers.map(manager => renderUserNode(manager))}
        </div>

        {/* Users Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-900/20 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
              👤 Users ({regularUsers.length})
            </h3>
          </div>
          {regularUsers.map(user => renderUserNode(user))}
        </div>

        {/* Unknown Roles Section */}
        {unknownRoles.length > 0 && (
          <div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 flex items-center">
                ❓ Unknown Roles ({unknownRoles.length})
              </h3>
            </div>
            {unknownRoles.map(user => renderUserNode(user))}
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No hierarchy data available
          </div>
        )}
      </div>

      {/* Organizational Structure Modal */}
      {showOrgModal && selectedOrgUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {getRoleIcon(selectedOrgUser.role)} {getDisplayName(selectedOrgUser)}'s Organization
              </h3>
              <button
                onClick={() => setShowOrgModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            {(() => {
              const orgStructure = getOrganizationalStructure(selectedOrgUser)
              if (!orgStructure) return <p>No organizational data available.</p>

              if (orgStructure.type === 'supervisor') {
                return (
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        📊 Managers ({orgStructure.managers?.length || 0})
                      </h4>
                      {(orgStructure.managers?.length || 0) > 0 ? (
                        <div className="space-y-1">
                          {orgStructure.managers?.map(manager => (
                            <div key={manager.id} className="text-sm">
                              {getRoleIcon(manager.role)} {getDisplayName(manager)} ({manager.email})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No managers assigned</p>
                      )}
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                        👤 Users ({orgStructure.users?.length || 0})
                      </h4>
                      {(orgStructure.users?.length || 0) > 0 ? (
                        <div className="space-y-1">
                          {orgStructure.users?.map(user => (
                            <div key={user.id} className="text-sm">
                              {getRoleIcon(user.role)} {getDisplayName(user)} ({user.email})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No users assigned</p>
                      )}
                    </div>
                  </div>
                )
              }

              if (orgStructure.type === 'manager') {
                return (
                  <div className="space-y-6">
                    {orgStructure.supervisor && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          📋 Supervisor
                        </h4>
                        <div className="text-sm">
                          {getRoleIcon(orgStructure.supervisor.role)} {getDisplayName(orgStructure.supervisor)} ({orgStructure.supervisor.email})
                        </div>
                      </div>
                    )}

                    {(orgStructure.peerManagers?.length || 0) > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          📊 Peer Managers ({orgStructure.peerManagers?.length || 0})
                        </h4>
                        <div className="space-y-1">
                          {orgStructure.peerManagers?.map(manager => (
                            <div key={manager.id} className="text-sm">
                              {getRoleIcon(manager.role)} {getDisplayName(manager)} ({manager.email})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                        👤 Assigned Users ({orgStructure.users?.length || 0})
                      </h4>
                      {(orgStructure.users?.length || 0) > 0 ? (
                        <div className="space-y-1">
                          {orgStructure.users?.map(user => (
                            <div key={user.id} className="text-sm">
                              {getRoleIcon(user.role)} {getDisplayName(user)} ({user.email})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No users assigned</p>
                      )}
                    </div>
                  </div>
                )
              }

              if (orgStructure.type === 'user') {
                return (
                  <div className="space-y-6">
                    {orgStructure.supervisor && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          📋 Supervisor
                        </h4>
                        <div className="text-sm">
                          {getRoleIcon(orgStructure.supervisor.role)} {getDisplayName(orgStructure.supervisor)} ({orgStructure.supervisor.email})
                        </div>
                      </div>
                    )}

                    {orgStructure.manager && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          📊 Manager
                        </h4>
                        <div className="text-sm">
                          {getRoleIcon(orgStructure.manager.role)} {getDisplayName(orgStructure.manager)} ({orgStructure.manager.email})
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if (orgStructure.type === 'admin') {
                return (
                  <div className="space-y-6">
                    {orgStructure.supervisorHierarchies && orgStructure.supervisorHierarchies.length > 0 ? (
                      orgStructure.supervisorHierarchies.map((supervisorHierarchy, index) => (
                        <div key={supervisorHierarchy.supervisor.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          {/* Supervisor */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                              📋 Supervisor
                            </h4>
                            <div className="text-sm font-medium">
                              {getRoleIcon(supervisorHierarchy.supervisor.role)} {getDisplayName(supervisorHierarchy.supervisor)} ({supervisorHierarchy.supervisor.email})
                            </div>
                          </div>

                          {/* Managers under this supervisor */}
                          {supervisorHierarchy.managers && supervisorHierarchy.managers.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-4">
                              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                                📊 Managers ({supervisorHierarchy.managers.length})
                              </h4>
                              <div className="space-y-3">
                                {supervisorHierarchy.managers.map((managerHierarchy) => (
                                  <div key={managerHierarchy.manager.id} className="border-l-2 border-yellow-300 pl-3">
                                    <div className="text-sm font-medium mb-1">
                                      {getRoleIcon(managerHierarchy.manager.role)} {getDisplayName(managerHierarchy.manager)} ({managerHierarchy.manager.email})
                                    </div>
                                    {/* Users under this manager */}
                                    {managerHierarchy.users && managerHierarchy.users.length > 0 && (
                                      <div className="ml-4 mt-2">
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Users:</div>
                                        {managerHierarchy.users.map((user) => (
                                          <div key={user.id} className="text-xs text-gray-700 dark:text-gray-300">
                                            {getRoleIcon(user.role)} {getDisplayName(user)} ({user.email})
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Users assigned directly to supervisor (not through a manager) */}
                          {supervisorHierarchy.directUsers && supervisorHierarchy.directUsers.length > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                                👤 Direct Users ({supervisorHierarchy.directUsers.length})
                              </h4>
                              <div className="space-y-1">
                                {supervisorHierarchy.directUsers.map((user) => (
                                  <div key={user.id} className="text-sm">
                                    {getRoleIcon(user.role)} {getDisplayName(user)} ({user.email})
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">No supervisors assigned to this admin yet.</p>
                      </div>
                    )}
                  </div>
                )
              }

              return <p>Unknown user type</p>
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
