'use client'

import { useState, useEffect } from 'react'
import { useVimeo } from '@/hooks/useVimeo'
import { useUser } from './AuthWrapper'
import { getViewableRoles, canEditContent } from '@/utils/roles'
import type { VimeoVideo } from '@/hooks/useVimeo'
import type { UserRole } from '@/types/supabase'

interface ParsedVideoInfo {
  id: string
  title: string
  description: string | null
  vimeo_url: string
  duration: number | null
  customer_name: string | null
  customer_email: string | null
  created_at: string
  thumbnail_url: string | null
  embed_url: string | null
  raw_description: string | null
  notes: string | null
  recorded_by: string | null
}

export default function UserVideos() {
  const { videos, loading, fetchVideos } = useVimeo()
  const { user, profile } = useUser()
  const [parsedVideos, setParsedVideos] = useState<ParsedVideoInfo[]>([])
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showRoleManager, setShowRoleManager] = useState(false)
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)

  // Check for impersonation
  useEffect(() => {
    const checkImpersonation = () => {
      const impersonationActive = localStorage.getItem('impersonation_active')
      const impersonatedUserData = localStorage.getItem('impersonation_target')
      
      if (impersonationActive === 'true' && impersonatedUserData) {
        const impersonated = JSON.parse(impersonatedUserData)
        setImpersonatedUser(impersonated)
        setIsImpersonating(true)
        console.log('🎭 UserVideos - Impersonation detected:', {
          originalUser: user?.email,
          impersonatedUser: impersonated
        })
      } else {
        setImpersonatedUser(null)
        setIsImpersonating(false)
      }
    }

    checkImpersonation()
    
    // Listen for storage changes
    const handleStorageChange = () => {
      checkImpersonation()
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user])

  // Create display name function with liaison mapping
  const getDisplayName = () => {
    // If impersonating, use the impersonated user's name
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.display_name || impersonatedUser.email?.split('@')[0] || 'Impersonated User'
    }
    
    // Otherwise use original user's name
    if (profile?.display_name) return profile.display_name
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    
        // Email-based name mapping for liaisons
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
          // Add other liaisons here as needed
        };
        
        if (user?.email) {
      // Check exact email match first
      if (emailToNameMap[user.email]) {
        return emailToNameMap[user.email]
      }
    }
    
    // Fallback to email username
    return user?.email?.split('@')[0] || 'User'
  }

  // Determine current user's role
  const getCurrentUserRole = (): UserRole => {
    // If impersonating, use the impersonated user's role
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.role
    }
    
    // Otherwise use original user's role
    // Check profile first (if available)
    if (profile?.role) {
      return profile.role
    }
    
    // Role mapping based on email patterns (for testing)
    if (user?.email) {
      const email = user.email.toLowerCase()
      
      // Admin accounts
      if (email.includes('admin') || email === 'john@tpnlife.com') {
        return 'admin'
      }
      
      // Supervisor accounts  
      if (email.includes('supervisor')) {
        return 'supervisor'
      }
      
      // Manager accounts
      if (email.includes('manager') || email === 'john+2@tpnlife.com') {
        return 'manager'
      }
      
      // All other emails default to user role
      // This includes john+1@tpnlife.com, john+user@tpnlife.com, user@tpnlife.com, etc.
    }
    
    // Default to user role
    return 'user'
  }

  // Get user role for display and filtering
  const userRole = getCurrentUserRole()
  const canEdit = canEditContent(userRole)

  // Filter videos based on role hierarchy
  const filterVideosByRole = (videos: ParsedVideoInfo[]): ParsedVideoInfo[] => {
    const viewableRoles = getViewableRoles(userRole)
    const currentUserDisplayName = getDisplayName()
    
    const filtered = videos.filter(video => {
      const recordedBy = video.recorded_by || ''
      
      // Admin can see everything
      if (userRole === 'admin') {
        return true
      }
      
      // Users can ONLY see their own content
      if (userRole === 'user') {
        return recordedBy === currentUserDisplayName
      }
      
      // Managers can see their own content + content from users assigned to them
      if (userRole === 'manager') {
        // Always show current user's own content
        if (recordedBy === currentUserDisplayName) {
          return true
        }
        
        // Since there are no actual user assignments in this system yet,
        // managers can only see their own content
        return false
      }
      
      // Supervisors can see their own content + content from managers and users
      if (userRole === 'supervisor') {
        // Always show current user's own content
        if (recordedBy === currentUserDisplayName) {
          return true
        }
        
        // Show content from managers and users (not other supervisors/admins)
        const isFromManagerOrUser = !recordedBy.includes('Supervisor') && 
                                   recordedBy !== 'John Bradshaw' // Admin account
        return isFromManagerOrUser
      }
      
      return false
    })
    
    return filtered
  }

  useEffect(() => {
    // Fetch videos when component mounts
    fetchVideos()
  }, [fetchVideos])

  useEffect(() => {
    // Parse customer information from video descriptions and apply role-based filtering
    if (videos.length > 0) {
      const parsed = videos.map(video => parseVideoInfo(video))
      const filtered = filterVideosByRole(parsed)
      setParsedVideos(filtered)
    } else {
      setParsedVideos([])
    }
  }, [videos, userRole]) // Add userRole dependency

  // Get unique users from all videos (for admin role management)
  const getUniqueUsers = () => {
    const users = new Set<string>()
    videos.forEach(video => {
      const parsed = parseVideoInfo(video)
      if (parsed.recorded_by) {
        users.add(parsed.recorded_by)
      }
    })
    return Array.from(users).sort()
  }

  // Get current role for a specific user (simulated - in real app this would come from database)
  const getUserRole = (userName: string): UserRole => {
    // This is a simulation - in a real app, you'd fetch this from your user database
    if (userName.includes('Bradshaw') && !userName.includes('(')) return 'admin'
    if (userName.includes('Supervisor')) return 'supervisor'
    if (userName.includes('Manager')) return 'manager'
    return 'user'
  }

  // Handle role change (simulated - in real app this would update the database)
  const handleRoleChange = async (userName: string, newRole: UserRole) => {
    setRoleChangeLoading(userName)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In a real app, you would:
    // 1. Update the user's role in your database
    // 2. Refresh the user list
    // 3. Show success/error messages
    
    console.log(`Would change ${userName} role to ${newRole}`)
    alert(`Role change simulation: ${userName} → ${newRole}\n\nIn a real app, this would update the database.`)
    
    setRoleChangeLoading(null)
  }

  const parseVideoInfo = (video: VimeoVideo): ParsedVideoInfo => {
    const description = video.description || ''
    
    // Parse customer information from structured description
    const customerNameMatch = description.match(/Customer:\s*(.+)/i)
    const customerEmailMatch = description.match(/Email:\s*(.+)/i)
    
    // Extract the liaison/recorder information
    const recordedByMatch = description.match(/Recorded by:\s*(.+?)(?:\n|$)/i)
    const recordedBy = recordedByMatch ? recordedByMatch[1].trim() : null
    
    // Extract the notes section (everything after "Additional notes:")
    const notesMatch = description.match(/Additional notes:\s*([\s\S]*)/i)
    const notes = notesMatch ? notesMatch[1].trim() : null
    
    return {
      id: video.uri.split('/').pop() || '',
      title: video.name,
      description: video.description,
      vimeo_url: video.link,
      duration: video.duration,
      customer_name: customerNameMatch ? customerNameMatch[1].trim() : null,
      customer_email: customerEmailMatch ? customerEmailMatch[1].trim() : null,
      created_at: video.created_time,
      thumbnail_url: video.pictures?.sizes?.[0]?.link || null,
      embed_url: video.player_embed_url,
      raw_description: description,
      notes: notes,
      recorded_by: recordedBy
    }
  }

  const truncateText = (text: string, lines: number = 3) => {
    const words = text.split(' ')
    const wordsPerLine = 10 // Approximate words per line
    const maxWords = lines * wordsPerLine
    
    if (words.length <= maxWords) {
      return text
    }
    
    return words.slice(0, maxWords).join(' ') + '...'
  }

  const openDescriptionModal = (description: string) => {
    setSelectedDescription(description)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedDescription(null)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (parsedVideos.length === 0) {
    return (
      <div className="text-center p-8">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No recordings yet</h3>
        <p className="text-gray-500 dark:text-gray-400">Start recording to see your videos here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Recordings</h3>
        
        <div className="flex items-center space-x-4">
          {/* Refresh button */}
          <button
            onClick={() => fetchVideos()}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg 
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span className="text-sm">Refresh</span>
          </button>

          {/* Role Manager button (Admin only) */}
          {userRole === 'admin' && (
            <button
              onClick={() => setShowRoleManager(!showRoleManager)}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" 
                />
              </svg>
              <span className="text-sm">Manage Roles</span>
            </button>
          )}
          
          {/* Role indicator and access scope */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-medium">
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </span>
              <span className="text-xs">
                {userRole === 'admin' && '• Viewing all recordings • Can edit/delete'}
                {userRole === 'supervisor' && '• Viewing manager & user recordings'}
                {userRole === 'manager' && '• Viewing assigned user recordings'}
                {userRole === 'user' && '• Viewing your recordings only'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Management Panel (Admin only) */}
      {userRole === 'admin' && showRoleManager && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">User Role Management</h4>
            <button
              onClick={() => setShowRoleManager(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {getUniqueUsers().map((userName) => {
              const currentRole = getUserRole(userName)
              return (
                <div key={userName} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{userName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Current role: {currentRole}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <select
                      value={currentRole}
                      onChange={(e) => handleRoleChange(userName, e.target.value as UserRole)}
                      disabled={roleChangeLoading === userName}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                    
                    {roleChangeLoading === userName && (
                      <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </div>
                </div>
              )
            })}
            
            {getUniqueUsers().length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <p>No users found from video recordings</p>
                <p className="text-sm">Users will appear here once they create recordings</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {parsedVideos.map((video) => (
          <div
            key={video.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Video thumbnail */}
            <div className="aspect-video bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative overflow-hidden">
              {video.thumbnail_url ? (
                <img 
                  src={video.thumbnail_url} 
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8a2 2 0 002-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v4a2 2 0 002 2z" />
                </svg>
              )}
              
              {/* Admin actions overlay */}
              {canEdit && (
                <div className="absolute top-1 right-1 flex space-x-1">
                  <button 
                    className="bg-yellow-500 hover:bg-yellow-600 text-white p-1 rounded text-xs opacity-75 hover:opacity-100 transition-opacity"
                    title="Edit video"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    className="bg-red-500 hover:bg-red-600 text-white p-1 rounded text-xs opacity-75 hover:opacity-100 transition-opacity"
                    title="Delete video"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Play button overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              {/* Duration overlay */}
              {video.duration && (
                <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                  {formatDuration(video.duration)}
                </div>
              )}
            </div>

            {/* Video information */}
            <div className="p-2">
              {/* Customer Information */}
              <div className="space-y-1 mb-2">
                {video.customer_name && (
                  <div className="flex items-center text-xs">
                    <svg className="w-3 h-3 text-blue-500 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{video.customer_name}</span>
                  </div>
                )}
                
                {video.customer_email && (
                  <div className="flex items-center text-xs">
                    <svg className="w-3 h-3 text-green-500 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400 truncate">{video.customer_email}</span>
                  </div>
                )}

                <div className="flex items-center text-xs">
                  <svg className="w-3 h-3 text-purple-500 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400 truncate">By: {video.recorded_by || 'Unknown'}</span>
                  {/* Role indicator for the current user */}
                  {userRole !== 'user' && (
                    <span className="ml-1 px-1 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {userRole}
                    </span>
                  )}
                </div>

                <div className="flex items-center text-xs">
                  <svg className="w-3 h-3 text-gray-500 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">{new Date(video.created_at).toLocaleDateString()}</span>
                </div>

                {/* Description (truncated) - Inside the card */}
                {video.notes && (
                  <div className="pt-1 border-t border-gray-200 dark:border-gray-600">
                    <div 
                      className="text-xs text-gray-700 dark:text-gray-300 break-words"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: '1.3em',
                        maxHeight: '2.6em',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word'
                      }}
                    >
                      {video.notes}
                    </div>
                    <button
                      onClick={() => openDescriptionModal(video.notes!)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs mt-0.5 underline"
                    >
                      Read More
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-center">
                {video.embed_url && (
                  <button
                    onClick={() => video.embed_url && window.open(video.embed_url, '_blank')}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors flex items-center space-x-1"
                  >
                    <span>▶️</span>
                    <span>Play</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Description Modal */}
      {showModal && selectedDescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl max-h-96 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Full Description</h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto max-h-72">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{selectedDescription}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
