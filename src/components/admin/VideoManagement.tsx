'use client'

import { useState, useEffect } from 'react'
import { useVimeo } from '@/hooks/useVimeo'
import { supabase } from '@/lib/supabase'
import { hasAdminAccess } from '@/utils/roles'
import type { UserRole } from '@/types/supabase'
import type { VimeoVideo } from '@/lib/vimeo'

interface VideoManagementProps {
  userRole: UserRole
}

interface ParsedVideoData {
  id: string
  title: string
  description: string | null
  vimeo_url: string | null
  duration: number | null
  created_at: string
  // Parsed customer info from description
  customer_name: string | null
  customer_email: string | null
  user_display_name: string | null
  notes: string | null
}

function parseCustomerInfo(description: string): { customerName?: string, customerEmail?: string, notes?: string, userDisplayName?: string } {
  const customerNameMatch = description.match(/Customer:\s*(.+?)(?:\n|$)/i)
  const customerEmailMatch = description.match(/Email:\s*(.+?)(?:\n|$)/i)
  const notesMatch = description.match(/Additional notes:\s*([\s\S]*)/i)
  
  // Try to extract user display name from description - it might be stored there
  // This would need to be implemented based on how the display name is stored in Vimeo descriptions
  const userDisplayNameMatch = description.match(/Recorded by:\s*(.+?)(?:\n|$)/i)
  
  return {
    customerName: customerNameMatch?.[1]?.trim(),
    customerEmail: customerEmailMatch?.[1]?.trim(),
    notes: notesMatch?.[1]?.trim(),
    userDisplayName: userDisplayNameMatch?.[1]?.trim()
  }
}

export default function VideoManagement({ userRole }: VideoManagementProps) {
  const { videos, loading, fetchVideos } = useVimeo()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'customer_name' | 'customer_email'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    console.log('🔍 VideoManagement: Getting current user...')
    getCurrentUser()
  }, [])

  useEffect(() => {
    console.log('🔍 VideoManagement: currentUser changed:', currentUser)
    if (currentUser) {
      console.log('🔍 VideoManagement: Fetching videos...')
      fetchVideos()
    }
  }, [fetchVideos, currentUser])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          // Combine profile data with auth user data
          setCurrentUser({
            ...profile,
            email: user.email,
            name: profile.name || user.user_metadata?.name
          })
        }
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  // Filter videos based on user role and assignments
  const filterVideosByRole = (allVideos: VimeoVideo[]): VimeoVideo[] => {
    console.log('Current user:', currentUser)
    console.log('User role:', userRole)
    console.log('All videos:', allVideos.length)
    
    if (userRole === 'admin') {
      return allVideos // Only admins see all videos
    }
    
    if (userRole === 'supervisor' || userRole === 'manager') {
      // Supervisors and Managers only see videos from their assigned users and their own videos
      const filteredVideos = allVideos.filter(video => {
        const parsed = parseCustomerInfo(video.description || '')
        const recordedBy = parsed.userDisplayName
        
        console.log('Video:', {
          title: video.name,
          recordedBy,
          description: video.description,
          currentUserName: currentUser?.name,
          currentUserEmail: currentUser?.email
        })
        
        // Can see their own videos
        if (recordedBy === currentUser?.name || recordedBy === currentUser?.email) {
          console.log('✅ Video matches current user')
          return true
        }
        
        // Check if the video creator is assigned to this supervisor/manager
        // For now, using localStorage assignments (in production, this would be from database)
        try {
          const assignments = JSON.parse(localStorage.getItem('assignments') || '[]')
          const myAssignments = assignments.filter((assignment: any) => 
            assignment.assignor_id === currentUser?.id
          )
          
          console.log('My assignments:', myAssignments)
          
          // Check if the video creator is in the supervisor/manager's assigned users
          const isAssigned = myAssignments.some((assignment: any) => {
            // Match by display name or email from video description
            return assignment.assignee?.name === recordedBy || 
                   assignment.assignee?.email === recordedBy
          })
          
          if (isAssigned) {
            console.log('✅ Video creator is assigned to me')
          } else {
            console.log('❌ Video creator not assigned to me')
          }
          
          return isAssigned
        } catch (error) {
          console.error('Error checking assignments:', error)
          return false
        }
      })
      
      console.log('Filtered videos:', filteredVideos.length)
      return filteredVideos
    }
    
    // Regular users only see their own videos
    if (userRole === 'user') {
      return allVideos.filter(video => {
        const parsed = parseCustomerInfo(video.description || '')
        const recordedBy = parsed.userDisplayName
        
        // User can only see their own videos
        return recordedBy === currentUser?.name || recordedBy === currentUser?.email
      })
    }
    
    return []
  }
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null)

  // Transform Vimeo videos to include parsed customer information and apply role-based filtering
  console.log('🔍 About to filter videos:', {
    totalVideos: videos.length,
    currentUser: currentUser?.name,
    userRole: userRole
  })
  
  const parsedVideos: ParsedVideoData[] = filterVideosByRole(videos).map(video => {
    const customerInfo = video.description ? parseCustomerInfo(video.description) : {}
    
    return {
      id: video.uri.split('/').pop() || '',
      title: video.name,
      description: video.description,
      vimeo_url: video.link,
      duration: video.duration,
      created_at: video.created_time,
      customer_name: customerInfo.customerName || null,
      customer_email: customerInfo.customerEmail || null,
      user_display_name: customerInfo.userDisplayName || 'Unknown User',
      notes: customerInfo.notes || null
    }
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const openDescriptionModal = (description: string) => {
    setSelectedDescription(description)
    setShowDescriptionModal(true)
  }

  const closeDescriptionModal = () => {
    setShowDescriptionModal(false)
    setSelectedDescription(null)
  }

  const handleVideoSelect = (videoId: string) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (selectedVideos.size === 0) return
    
    if (confirm(`Are you sure you want to delete ${selectedVideos.size} selected video(s)? This action cannot be undone.`)) {
      // TODO: Implement actual delete functionality
      console.log('Deleting videos:', Array.from(selectedVideos))
      setSelectedVideos(new Set())
    }
  }

  const filteredVideos = parsedVideos.filter(video =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (video.customer_name && video.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (video.customer_email && video.customer_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (video.user_display_name && video.user_display_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    let aValue: any
    let bValue: any
    
    if (sortBy === 'created_at') {
      aValue = new Date(a.created_at).getTime()
      bValue = new Date(b.created_at).getTime()
    } else {
      aValue = a[sortBy] || ''
      bValue = b[sortBy] || ''
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // Pagination
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(sortedVideos.length / itemsPerPage)
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'all' ? sortedVideos.length : startIndex + itemsPerPage
  const paginatedVideos = sortedVideos.slice(startIndex, endIndex)

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Video Management</h2>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {parsedVideos.length} {userRole === 'manager' ? 'assigned user' : 'total'} videos
            </span>
            {userRole === 'manager' && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                Manager View: Assigned User Videos Only
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
            placeholder="Search videos, customers, users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="created_at">Sort by Date</option>
            <option value="customer_name">Sort by Customer</option>
            <option value="customer_email">Sort by Email</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Table Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleDeleteSelected}
            disabled={selectedVideos.size === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
          >
            Delete Selected ({selectedVideos.size})
          </button>
          
          {/* Vimeo Folder Button - Only for Admins/Supervisors */}
          {hasAdminAccess(userRole) && userRole !== 'manager' && (
            <button
              onClick={() => window.open('https://vimeo.com/user/230665591/folder/26524560?isPrivate=false', '_blank')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white rounded-md shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              <svg 
                className="w-4 h-4" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
              </svg>
              <span>Sparky Recordings Folder</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label htmlFor="itemsPerPage" className="text-sm text-gray-700 dark:text-gray-300">
            Items per page:
          </label>
          <select
            id="itemsPerPage"
            value={itemsPerPage}
            onChange={(e) => {
              const value = e.target.value === 'all' ? 'all' : parseInt(e.target.value)
              setItemsPerPage(value)
              setCurrentPage(1)
            }}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* Videos Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Recorded By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedVideos.map((video) => (
              <tr key={video.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.id)}
                    onChange={() => handleVideoSelect(video.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {video.customer_name || 'Unknown Customer'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {video.customer_email || 'No email provided'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {video.user_display_name || 'Unknown User'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {formatDate(video.created_at)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {video.notes ? (
                    <div className="max-w-xs">
                      <div 
                        className="text-sm text-gray-900 dark:text-white break-words"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.4em',
                          maxHeight: '4.2em',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word'
                        }}
                      >
                        {video.notes}
                      </div>
                      {video.notes.length > 100 && (
                        <button
                          onClick={() => openDescriptionModal(video.notes!)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mt-1 underline"
                        >
                          Read More
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">No description</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {itemsPerPage !== 'all' && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedVideos.length)} of {sortedVideos.length} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* No Results */}
      {sortedVideos.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No videos found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search criteria.' : 'Videos will appear here once users start recording.'}
          </p>
        </div>
      )}

      {/* Description Modal */}
      {showDescriptionModal && selectedDescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl max-h-96 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Full Description</h3>
                <button
                  onClick={closeDescriptionModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto max-h-72">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedDescription}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
