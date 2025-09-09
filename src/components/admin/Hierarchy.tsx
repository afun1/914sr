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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch real users from Supabase
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
        setUsers(usersData || [])
      }
      
      // Fetch assignments from localStorage for now
      const storedAssignments = localStorage.getItem('userAssignments')
      if (storedAssignments) {
        setAssignments(JSON.parse(storedAssignments))
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
    const assignedUserIds = assignments
      .filter(a => a.assignor_id === supervisorId)
      .map(a => a.assignee_id)
    
    return users.filter(u => assignedUserIds.includes(u.id) && u.role === targetRole)
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
    const assignedManagers = getAssignedUsers(user.id, 'manager')
    const assignedUsers = getAssignedUsers(user.id, 'user')
    const hasChildren = assignedManagers.length > 0 || assignedUsers.length > 0

    const indentStyle = {
      paddingLeft: `${level * 24}px`
    }

    return (
      <div key={user.id} className="border-l-2 border-gray-200 dark:border-gray-600">
        <div 
          className="flex items-center py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          style={indentStyle}
          onClick={() => hasChildren && toggleExpanded(user.id)}
        >
          {hasChildren && (
            <span className="mr-2 text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span className="mr-4"></span>}
          
          <span className="mr-2">{getRoleIcon(user.role)}</span>
          <span className={`font-medium ${getRoleColor(user.role)}`}>
            {getDisplayName(user)}
          </span>
          <span className="ml-2 text-sm text-gray-500">
            ({user.email})
          </span>
          <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {user.role}
          </span>
          
          {hasChildren && (
            <span className="ml-auto text-xs text-gray-400">
              {assignedManagers.length + assignedUsers.length} assigned
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="ml-4">
            {assignedManagers.length > 0 && (
              <div>
                <div className="flex items-center py-1 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                  📊 Managers
                </div>
                {assignedManagers.map((manager, index) => (
                  <div key={manager.id}>
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
                {assignedUsers.map((assignedUser, index) => 
                  renderUserNode(assignedUser, level + 1, index === assignedUsers.length - 1)
                )}
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
    </div>
  )
}
