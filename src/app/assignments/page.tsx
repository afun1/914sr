'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeProvider'
import GlobalHeader from '@/components/GlobalHeader'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/supabase'

interface Profile {
  id: string
  email: string
  role: UserRole
  first_name?: string
  last_name?: string
  created_at?: string
}

interface Assignment {
  id: string
  assignee_id: string
  assignor_id: string
  assignee_role: UserRole
  assignor_role: UserRole
  assignee?: Profile
  assignor?: Profile
  created_at: string
}

export default function AssignmentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')

  // ...existing code...

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedAssignments = assignments
    .filter(assignment => 
      assignment.assignee?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.assignor?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.assignee_role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.assignor_role.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0
      
      let aVal: any, bVal: any
      
      switch (sortField) {
        case 'assignee':
          aVal = a.assignee?.email || ''
          bVal = b.assignee?.email || ''
          break
        case 'assignor':
          aVal = a.assignor?.email || ''
          bVal = b.assignor?.email || ''
          break
        case 'assignee_role':
          aVal = a.assignee_role
          bVal = b.assignee_role
          break
        case 'assignor_role':
          aVal = a.assignor_role
          bVal = b.assignor_role
          break
        case 'created_at':
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
        default:
          return 0
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  const exportToCSV = () => {
    const headers = ['Assignee Email', 'Assignee Name', 'Assignee Role', 'Assignor Email', 'Assignor Name', 'Assignor Role', 'Created Date']
    const csvData = filteredAndSortedAssignments.map(assignment => [
      assignment.assignee?.email || '',
      `${assignment.assignee?.first_name || ''} ${assignment.assignee?.last_name || ''}`.trim(),
      assignment.assignee_role,
      assignment.assignor?.email || '',
      `${assignment.assignor?.first_name || ''} ${assignment.assignor?.last_name || ''}`.trim(),
      assignment.assignor_role,
      new Date(assignment.created_at).toLocaleDateString()
    ])
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assignments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/?redirect=assignments')
        return
      }

      // Restrict access to john@tpnlife.com only
      if (user.email !== 'john@tpnlife.com') {
        router.push('/dashboard')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUser(user)
        setUserRole(profile.role)
        await fetchAssignments()
        await fetchUsers()
      }
    } catch (error) {
      console.error('Error checking access:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignments = async () => {
    try {
      console.log('Fetching assignments from Supabase...')
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          assignee:profiles!assignments_assignee_id_fkey(*),
          assignor:profiles!assignments_assignor_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Assignments fetch error:', error)
        throw error
      }
      
      console.log('Assignments data:', data)
      setAssignments(data || [])
    } catch (error) {
      console.error('Error fetching assignments:', error)
      setError('Failed to fetch assignments')
    }
  }

  const fetchUsers = async () => {
    try {
      console.log('Fetching users from Supabase...')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })

      if (error) {
        console.error('Users fetch error:', error)
        throw error
      }
      
      console.log('Users data:', data)
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to fetch users')
    }
  }

  const createAssignment = async (assigneeId: string, assignorId: string) => {
    try {
      const assignee = users.find(u => u.id === assigneeId)
      const assignor = users.find(u => u.id === assignorId)

      if (!assignee || !assignor) {
        throw new Error('Invalid user selection')
      }

      console.log('Creating assignment:', { assignee: assignee.email, assignor: assignor.email })

      const { error } = await supabase
        .from('assignments')
        .insert({
          assignee_id: assigneeId,
          assignor_id: assignorId,
          assignee_role: assignee.role,
          assignor_role: assignor.role
        })

      if (error) throw error

      console.log('Assignment created successfully!')
      await fetchAssignments()
    } catch (error: any) {
      console.error('Error creating assignment:', error)
      setError(error.message)
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    try {
      console.log('Removing assignment:', assignmentId)
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      console.log('Assignment removed successfully!')
      await fetchAssignments()
    } catch (error) {
      console.error('Error removing assignment:', error)
      setError('Failed to remove assignment')
    }
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

  const getUnassignedUsers = (role: UserRole) => {
    const assignedIds = assignments
      .filter(a => a.assignee_role === role)
      .map(a => a.assignee_id)
    
    return users.filter(u => u.role === role && !assignedIds.includes(u.id))
  }

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ThemeProvider>
    )
  }

  if (!user) {
    return null
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GlobalHeader user={user} />
        
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Assignment Records
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              View assignment decisions made from the Users page (Read-only)
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              {error}
              <button 
                onClick={() => setError(null)}
                className="float-right text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {/* Assignment Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">U</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Unassigned Users
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {getUnassignedUsers('user').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">M</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Unassigned Managers
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {getUnassignedUsers('manager').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">S</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Unassigned Supervisors
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {getUnassignedUsers('supervisor').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">T</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Assignments
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {assignments.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spreadsheet Controls */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Assignments
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder="Search by email, role, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  📊 Export CSV
                </button>
                <button
                  onClick={() => fetchAssignments()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredAndSortedAssignments.length} of {assignments.length} assignments
            </div>
          </div>

          {/* Spreadsheet-Style Table */}
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                📋 Assignment Records
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Assignment decisions recorded from the Users page • Spreadsheet View
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th 
                      onClick={() => handleSort('assignee')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-1">
                        👤 Assignee
                        {sortField === 'assignee' && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('assignee_role')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-1">
                        🏷️ Role
                        {sortField === 'assignee_role' && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('assignor')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-1">
                        👥 Assigned To
                        {sortField === 'assignor' && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('assignor_role')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-1">
                        🎯 Manager Role
                        {sortField === 'assignor_role' && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('created_at')}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <div className="flex items-center gap-1">
                        📅 Created
                        {sortField === 'created_at' && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredAndSortedAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="text-gray-400 dark:text-gray-500">
                          <div className="text-4xl mb-2">📋</div>
                          <div className="text-lg font-medium">No assignment records found</div>
                          <div className="text-sm">
                            {searchTerm ? 'Try adjusting your search terms' : 'Assignment decisions will appear here when made from the Users page'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedAssignments.map((assignment, index) => (
                      <tr 
                        key={assignment.id} 
                        className={`hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                          index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'
                        }`}
                      >
                        <td className="px-6 py-4 border-r border-gray-100 dark:border-gray-700">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {assignment.assignee?.email}
                          </div>
                          {assignment.assignee?.first_name && assignment.assignee?.last_name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {assignment.assignee.first_name} {assignment.assignee.last_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-gray-100 dark:border-gray-700">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(assignment.assignee_role)}`}>
                            {assignment.assignee_role}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r border-gray-100 dark:border-gray-700">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {assignment.assignor?.email}
                          </div>
                          {assignment.assignor?.first_name && assignment.assignor?.last_name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {assignment.assignor.first_name} {assignment.assignor.last_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-gray-100 dark:border-gray-700">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(assignment.assignor_role)}`}>
                            {assignment.assignor_role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {new Date(assignment.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-xs">
                              {new Date(assignment.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}