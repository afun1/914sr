// filepath: c:\sr97\src\app\admin\folders\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GlobalHeader from '@/components/GlobalHeader'

export default function AdminFoldersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalVideo, setModalVideo] = useState<any>(null)
  const [editingMeta, setEditingMeta] = useState<any>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set())

  // Placeholder modal state and handler added for backup compilation (no behavioral change)
  const [showAddFolderModal, setShowAddFolderModal] = useState(false)
  const handleCreateFolder = async () => { /* noop in backup */ }

  // Helpers
  const getIdFromUri = (uri?: string | null) => {
    if (!uri) return ''
    const parts = uri.split('/')
    return parts[parts.length - 1] || ''
  }

  const getVideoMeta = (video: any) => {
    const description = video?.description || ''
    const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
    const emailMatch = description.match(/Email: ([^\n\r]+?)(?:\s+Liaison:|$)/)
    const liaisonMatch = description.match(/Liaison: ([^\n\r]+?)(?:\s+Recorded:|$)/)
    // attempt to find any liaison email present in the description (fallback)
    const anyEmailMatches = description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || []

    const recordedMatch = description.match(/Recorded: ([^\n\r]+?)(?:\n|$)/)

    let customerName = customerMatch ? customerMatch[1].trim() : (video?.customerName || '')
    // Fallback: strip common prefixes from video.name like "Recording for"
    if (!customerName && video?.name) {
      customerName = video.name.replace(/^Recording(?: session)? for\s*/i, '').trim()
    }

    const customerEmail = emailMatch ? emailMatch[1].trim() : (video?.customerEmail || '')
    const liaisonName = liaisonMatch ? liaisonMatch[1].trim() : (video?.liaisonName || '')
    const recordedTime = recordedMatch ? recordedMatch[1].trim() : (video?.created_time ? new Date(video.created_time).toLocaleString() : '')

    let comments = ''
    if (recordedMatch) {
      const afterRecorded = description.split('Recorded: ' + recordedMatch[1])[1]
      if (afterRecorded) {
        comments = afterRecorded.trim()
        if (comments.startsWith('Notes:')) comments = comments.substring(6).trim()
      }
    }

    // Determine liaison email: prefer explicit prop, otherwise pick an email in the description that's not the customerEmail
    let liaisonEmail = video?.liaisonEmail || ''
    const foundEmails = anyEmailMatches.map((e: string) => e.toLowerCase())
    const custEmailLower = (video?.customerEmail || customerMatch?.[1] || '').toLowerCase()
    const pick = foundEmails.find((e: string) => e && e !== custEmailLower)
    if (!liaisonEmail && pick) liaisonEmail = pick

    return { customerName, customerEmail, liaisonName, liaisonEmail, recordedTime, comments }
  }

  useEffect(() => {
    getCurrentUser()
    fetchFolders()
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('#userSearch') && !target.closest('.user-dropdown')) setShowDropdown(false)
    }
    if (showDropdown) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showDropdown])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      if (!user) return
      const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!error && profile) setUserRole(profile.role)
    } catch (err) {
      console.error('Error getting current user:', err)
    }
  }

  const fetchFolders = async () => {
    try {
      setLoading(true)
      const vimeoResp = await fetch('/api/vimeo/folders')
      const all: any[] = []
      if (vimeoResp.ok) {
        const json = await vimeoResp.json()
        all.push(...(json.folders || []))
      }

      // build processedFolders (keep main and liaison local folders)
      let processed = all.map((f: any) => ({ ...f, isMainFolder: /team.*library/i.test(f.name || '') || /sparky.*screen.*recording/i.test(f.name || ''), customerCount: (f.videos || []).length }))

      // fetch profiles and build liaison folders
      try {
        const { data: profiles, error } = await supabase.from('profiles').select('id, display_name, first_name, last_name, email')
        if (!error && profiles) {
          const allVideos = all.flatMap(f => f.videos || [])
          const liaisonFolders = profiles.map((p: any) => {
            const name = (p.display_name || `${p.first_name || ''} ${p.last_name || ''}`).trim()
            const email = (p.email || '').trim()
            const emailLower = email.toLowerCase()
            const matchedVideos = allVideos.filter((v: any) => {
              const desc = (v.description || '').toLowerCase()
              const vLiaisonEmail = (v.liaisonEmail || '').toLowerCase()
              const vCustomerEmail = (v.customerEmail || '').toLowerCase()
              const vLiaisonName = (v.liaisonName || '').toLowerCase()
              const serialized = JSON.stringify(v || {}).toLowerCase()
              // match by explicit liaisonEmail, customerEmail, any occurrence of the email in the serialized video, or liaisonName equality
              if (emailLower) {
                if (vLiaisonEmail === emailLower) return true
                if (vCustomerEmail === emailLower) return true
                if (desc.includes(emailLower)) return true
                if (serialized.includes(emailLower)) return true
              }
              if (vLiaisonName && vLiaisonName === name.toLowerCase()) return true
              return false
            })
            return { name, email, uri: `local://liaison/${p.id}`, isMainFolder: false, videos: matchedVideos, customerCount: new Set(matchedVideos.map((mv: any) => (mv.name || mv.customerName || 'Unknown'))).size }
          })
          console.log('📁 Liaison folder matches:', liaisonFolders.map(l => ({ name: l.name, count: (l.videos || []).length })))
          processed.push(...liaisonFolders)
        }
      } catch (e) { console.warn('profiles fallback fail', e) }

      // ensure main repo first
      processed.sort((a: any, b: any) => {
        if (a.isMainFolder && !b.isMainFolder) return -1
        if (!a.isMainFolder && b.isMainFolder) return 1
        return (a.name || '').localeCompare(b.name || '')
      })

      setFolders(processed)
    } catch (err) {
      console.error('Error fetching folders:', err)
    } finally {
      setLoading(false)
    }
  }

  const openFolder = (folder: any) => {
    setSelectedFolder(folder)
  }

  const backToFolders = () => {
    setSelectedFolder(null)
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase.from('profiles').select('id, display_name, first_name, last_name, email').order('display_name')
      if (error) { console.error('Error fetching users', error); return }
      setUsers(data || [])
      setFilteredUsers(data || [])
    } catch (err) { console.error('Error fetching users', err) } finally { setLoadingUsers(false) }
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowDropdown(true)
    if (!value.trim()) { setFilteredUsers(users); setSelectedUser(null); return }
    if ((!users || users.length === 0) && !loadingUsers) fetchUsers().catch(() => {})
    const term = value.toLowerCase()
    const filtered = (users || []).filter(u => ((u.display_name || `${u.first_name || ''} ${u.last_name || ''}`).toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)))
    setFilteredUsers(filtered)
  }

  const handleUserSelect = (user: any) => {
    setSelectedUser(user)
    const displayName = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User'
    setSearchQuery(`${displayName} (${user.email})`)
    setShowDropdown(false)

    // open liaison folder if exists or build local
    const liaisonUri = `local://liaison/${user.id}`
    const userEmailLower = (user.email || '').toLowerCase()
    const existing = folders.find((f: any) => {
      if (f.isMainFolder) return false
      const lower = (f.name || '').toLowerCase()
      const folderEmailLower = ((f.email || '')).toLowerCase()
      return f.uri === liaisonUri || lower.includes(displayName.toLowerCase()) || (userEmailLower && folderEmailLower && folderEmailLower.includes(userEmailLower))
    })
    if (existing) { openFolder(existing); return }
    const allVideos = folders.flatMap(f => f.videos || [])
    const email = (user.email || '').toLowerCase()
    const matchedVideos = allVideos.filter((v: any) => {
      const desc = (v.description || '').toLowerCase()
      const vLiaisonEmail = (v.liaisonEmail || '').toLowerCase()
      const vCustomerEmail = (v.customerEmail || '').toLowerCase()
      const vLiaisonName = (v.liaisonName || '').toLowerCase()
      const serialized = JSON.stringify(v || {}).toLowerCase()
      if (email && (vLiaisonEmail === email || vCustomerEmail === email || desc.includes(email) || serialized.includes(email))) return true
      if (vLiaisonName && vLiaisonName === displayName.toLowerCase()) return true
      return false
    })
    console.log('🔎 User select', displayName, email, 'matched', matchedVideos.length, 'videos')
    const local = { name: displayName, email: user.email || '', uri: liaisonUri, isMainFolder: false, videos: matchedVideos, customerCount: new Set(matchedVideos.map((m: any) => m.name || m.customerName || 'Unknown')).size }
    openFolder(local)
  }

  // Admin metadata editing
  const handleOpenEditMeta = (video: any) => {
    if (userRole !== 'admin') return
    const meta = getVideoMeta(video)
    setEditingMeta({ videoUri: video.uri, customerName: meta.customerName || '', customerEmail: meta.customerEmail || '', liaisonName: meta.liaisonName || '', liaisonEmail: meta.liaisonEmail || '', comments: meta.comments || '' })
    setModalVideo(video)
  }

  const handleCancelEditMeta = () => setEditingMeta(null)

  const handleSaveMeta = async () => {
    if (!editingMeta || !editingMeta.videoUri) return
    setSavingMeta(true)
    try {
      const videoId = getIdFromUri(editingMeta.videoUri)
      // Try to persist to the server; if it fails, fall back to local update
      try {
        const res = await fetch(`/api/vimeo/videos?update=${encodeURIComponent(videoId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: editingMeta.customerName, customerEmail: editingMeta.customerEmail, liaisonName: editingMeta.liaisonName, liaisonEmail: editingMeta.liaisonEmail, comments: editingMeta.comments })
        })
        if (!res.ok) {
          const errText = await res.text()
          console.warn('⚠️ Remote save failed, falling back to local update:', errText)
        } else {
          console.log('✅ Remote save succeeded')
        }
      } catch (apiErr) {
        console.warn('⚠️ Error calling save API, falling back to local update:', apiErr)
      }

      // Always apply local state update so user sees their changes immediately
      setModalVideo((prev: any) => prev ? { ...prev, customerName: editingMeta.customerName, customerEmail: editingMeta.customerEmail, liaisonName: editingMeta.liaisonName, liaisonEmail: editingMeta.liaisonEmail, _comments: editingMeta.comments } : prev)
      setSelectedFolder((prev: any) => {
        if (!prev) return prev
        const updated = (prev.videos || []).map((v: any) => v.uri === editingMeta.videoUri ? { ...v, customerName: editingMeta.customerName, customerEmail: editingMeta.customerEmail, liaisonName: editingMeta.liaisonName, liaisonEmail: editingMeta.liaisonEmail, _comments: editingMeta.comments } : v)
        return { ...prev, videos: updated }
      })
      setEditingMeta(null)
    } catch (err) { console.error('save meta error', err); alert('Error saving metadata: ' + (err instanceof Error ? err.message : 'Unknown')) }
    finally { setSavingMeta(false) }
  }

  const handleDeleteVideo = async (videoUri: string, videoName: string) => {
    if (!confirm(`Are you sure you want to delete the video "${videoName}"? This action cannot be undone.`)) {
      return
    }

    const videoId = videoUri.split('/').pop() || ''
    if (videoId) setDeletingItems(prev => new Set([...Array.from(prev), videoId]))

    try {
      const response = await fetch(`/api/vimeo/videos?delete=${videoId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        console.log('✅ Video deleted successfully')
        // Refresh the current folder to update the video list
        if (selectedFolder) {
          const updatedVideos = selectedFolder.videos.filter((v: any) => v.uri !== videoUri)
          setSelectedFolder({
            ...selectedFolder,
            videos: updatedVideos
          })
        }
        fetchFolders() // Also refresh the main folders list
      } else {
        const error = await response.json()
        console.error('❌ Failed to delete video:', error)
        alert('Failed to delete video: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Error deleting video:', error)
      alert('Error deleting video: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      if (videoId) setDeletingItems(prev => {
        const updated = new Set(prev)
        updated.delete(videoId)
        return updated
      })
    }
  }

  const handleDeleteFolder = async (folderUri: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and ALL its videos? This action cannot be undone.`)) {
      return
    }

    const folderId = folderUri.split('/').pop() || ''
    console.log('🗑️ Attempting to delete folder:', folderId, 'from URI:', folderUri)
    if (folderId) setDeletingItems(prev => new Set([...Array.from(prev), folderId]))

    try {
      const apiUrl = `/api/vimeo/folders?delete=${folderId}`
      console.log('📡 Making DELETE request to:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📡 Response status:', response.status)
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Folder deleted successfully:', result)
        // If we're currently viewing the deleted folder, go back to folders view
        if (selectedFolder && selectedFolder.uri === folderUri) {
          setSelectedFolder(null)
        }
        fetchFolders() // Refresh the folders list
      } else {
        const contentType = response.headers.get('content-type')
        console.log('❌ Response content-type:', contentType)
        
        let errorMessage = 'Unknown error'
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json()
          errorMessage = error.error || error.message || 'Unknown error'
        } else {
          const errorText = await response.text()
          console.log('❌ Raw error response:', errorText.substring(0, 200))
          errorMessage = 'Server returned HTML instead of JSON - API route may not exist'
        }
        
        console.error('❌ Failed to delete folder:', errorMessage)
        alert('Failed to delete folder: ' + errorMessage)
      }
    } catch (error) {
      console.error('❌ Error deleting folder:', error)
      alert('Error deleting folder: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      if (folderId) setDeletingItems(prev => {
        const updated = new Set(prev)
        updated.delete(folderId)
        return updated
      })
    }
  }

  if (loading) {
    return (
      <>
        <GlobalHeader user={currentUser} />
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading folders...</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Show individual folder contents
  if (selectedFolder) {
    return (
      <>
        <GlobalHeader user={currentUser} />
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
              <button
                onClick={backToFolders}
                className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Folders
              </button>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {selectedFolder.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {selectedFolder.videos?.length || 0} videos
              </p>
            </div>

            {/* 6-Column Video Grid */}
            {selectedFolder.videos && selectedFolder.videos.length > 0 ? (
              <div className="grid grid-cols-6 gap-4">
                {selectedFolder.videos.map((video: any, videoIndex: number) => (
                  <div key={video.uri || videoIndex} className="group">
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-2 relative hover:shadow-lg transition-shadow">
                      {video.pictures?.sizes?.[0]?.link ? (
                        <img
                          src={video.pictures.sizes.find((size: any) => size.width >= 640)?.link || video.pictures.sizes[0].link}
                          alt={video.customerName || video.name || 'Video'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Duration badge */}
                      {video.duration && (
                        <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                      
                      {/* Play button overlay */}
                      <div 
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setModalVideo(video)
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-black hover:bg-opacity-20 transition-all duration-200 cursor-pointer"
                      >
                        <div className="bg-white bg-opacity-90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg pointer-events-none">
                          <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>

                      {/* Admin Delete Button */}
                      {userRole === 'admin' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const videoName = (() => {
                              const description = video.description || ''
                              const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
                              return customerMatch ? customerMatch[1].trim() : (video.customerName || video.name || 'Video')
                            })()
                            handleDeleteVideo(video.uri, videoName)
                          }}
                          disabled={deletingItems.has(video.uri.split('/').pop())}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-10"
                          title="Delete Video"
                        >
                          {deletingItems.has(video.uri.split('/').pop()) ? (
                            <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    
                    <div className="p-2">
                      {(() => {
                        const description = video.description || ''
                        const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
                        const emailMatch = description.match(/Email: ([^\n\r]+?)(?:\s+Liaison:|$)/)
                        const liaisonMatch = description.match(/Liaison: ([^\n\r]+?)(?:\s+Recorded:|$)/)
                        const recordedMatch = description.match(/Recorded: ([^\n\r]+?)(?:\n|$)/)
                        
                        const customerName = customerMatch ? customerMatch[1].trim() : (video.customerName || video.name || 'Unknown Customer')
                        
                        // Extract remaining text as comments (everything after the structured data)
                        let comments = description
                        if (recordedMatch) {
                          const afterRecorded = description.split('Recorded: ' + recordedMatch[1])[1]
                          if (afterRecorded) {
                            // Clean up the comments - remove "Notes:" prefix and redundant text
                            comments = afterRecorded.trim()
                            if (comments.startsWith('Notes:')) {
                              comments = comments.substring(6).trim()
                            }
                            // Remove redundant "recording session for [customer]" text
                            const redundantPattern = new RegExp(`recording session for ${customerName}\\.$`, 'i')
                            comments = comments.replace(redundantPattern, '').trim()
                          } else {
                            comments = ''
                          }
                        }
                        
                        const customerEmail = emailMatch ? emailMatch[1].trim() : ''
                        const liaisonName = liaisonMatch ? liaisonMatch[1].trim() : (video.liaisonName || 'Unknown liaison')
                        const recordedTime = recordedMatch ? recordedMatch[1].trim() : (video.created_time ? new Date(video.created_time).toLocaleDateString() + ', ' + new Date(video.created_time).toLocaleTimeString() : 'Unknown date')
                        
                        return (
                          <>
                            <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate mb-1">
                              {customerName}
                            </h3>
                            
                            {customerEmail && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                                {customerEmail}
                              </p>
                            )}
                            
                            <p className="text-xs text-blue-600 dark:text-blue-400 truncate mb-1">
                              {liaisonName}
                            </p>
                            
                            <p className="text-xs text-gray-500 dark:text-gray-500 truncate mb-2">
                              {recordedTime}
                            </p>
                            
                            {comments && comments.length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight" 
                                 style={{
                                   display: '-webkit-box',
                                   WebkitLineClamp: 3,
                                   WebkitBoxOrient: 'vertical',
                                   overflow: 'hidden'
                                 }}>
                                {comments}
                              </p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">🎥</div>
                <h3 className="text-xl font-semibold mb-2">No videos in this folder</h3>
                <p>This folder is empty.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Video Modal for folder contents view */}
        {modalVideo && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setModalVideo(null)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with title and close button */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {(() => {
                    const description = modalVideo.description || ''
                    const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
                    return customerMatch ? customerMatch[1].trim() : (modalVideo.customerName || modalVideo.name || 'Video')
                  })()}
                </h3>
                <button
                  onClick={() => setModalVideo(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2"
                  title="Close (or click outside)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Video player */}
              <div className="p-4 flex-shrink-0">
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-sm opacity-75">Loading video...</p>
                    </div>
                  </div>
                  
                  <iframe
                    src={`https://player.vimeo.com/video/${modalVideo.uri?.split('/').pop()}?autoplay=1&background=0&loop=0&byline=0&portrait=0&title=0&speed=1&transparent=0&gesture=media&playsinline=1&responsive=1`}
                    className="w-full h-full absolute inset-0"
                    allow="autoplay; fullscreen; picture-in-picture; accelerometer; gyroscope"
                    allowFullScreen
                    loading="eager"
                  />
                </div>
              </div>
              
              {/* Metadata below player - Balanced layout for long names/emails */}
              <div className="px-4 pb-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-12 gap-3 text-sm">
                  {/* Column 1: Customer & Email - Quarter space */}
                  <div className="col-span-3 space-y-2">
                    <p className="text-gray-900 dark:text-white font-medium text-sm leading-tight break-words">
                      {(() => {
                        const description = modalVideo.description || ''
                        const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
                        return customerMatch ? customerMatch[1].trim() : (modalVideo.customerName || modalVideo.name || 'Unknown')
                      })()}
                    </p>
                    
                    <p className="text-blue-600 dark:text-blue-400 break-all text-xs leading-tight">
                      {(() => {
                        const description = modalVideo.description || ''
                        const emailMatch = description.match(/Email: ([^\n\r]+?)(?:\s+Liaison:|$)/)
                        return emailMatch ? emailMatch[1].trim() : 'No email'
                      })()}
                    </p>
                  </div>
                  
                  {/* Column 2: Liaison & Date - Quarter space */}
                  <div className="col-span-3 space-y-2">
                    <p className="text-gray-900 dark:text-white text-sm leading-tight break-words">
                      {(() => {
                        const description = modalVideo.description || ''
                        const liaisonMatch = description.match(/Liaison: ([^\n\r]+?)(?:\s+Recorded:|$)/)
                        return liaisonMatch ? liaisonMatch[1].trim() : 'Unknown'
                      })()}
                    </p>
                    
                    <p className="text-gray-600 dark:text-gray-400 text-xs leading-tight break-words">
                      {(() => {
                        const description = modalVideo.description || ''
                        const recordedMatch = description.match(/Recorded: ([^\n\r]+?)(?:\n|$)/)
                        return recordedMatch ? recordedMatch[1].trim() : (modalVideo.created_time ? new Date(modalVideo.created_time).toLocaleString() : 'Unknown')
                      })()}
                    </p>
                  </div>
                  
                  {/* Column 3: Comments with scroll - Half space */}
                  <div className="col-span-6">
                    {(() => {
                      const description = modalVideo.description || ''
                      const recordedMatch = description.match(/Recorded: ([^\n\r]+?)(?:\n|$)/)
                      let comments = ''
                      
                      if (recordedMatch) {
                        const afterRecorded = description.split('Recorded: ' + recordedMatch[1])[1]
                        if (afterRecorded) {
                          comments = afterRecorded.trim()
                          if (comments.startsWith('Notes:')) {
                            comments = comments.substring(6).trim()
                          }
                          const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
                          const customerName = customerMatch ? customerMatch[1].trim() : ''
                          const redundantPattern = new RegExp(`recording session for ${customerName}\\.$`, 'i')
                          comments = comments.replace(redundantPattern, '').trim()
                        }
                      }
                      
                      return comments ? (
                        <div className="h-20 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap break-words">
                            {comments}
                          </p>
                        </div>
                      ) : (
                        <div className="h-20 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No comments</p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Show folders view
  return (
    <>
      <GlobalHeader user={currentUser} />
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                📁 Liaison Video Folders
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Click on a folder to view its contents
              </p>
            </div>
          </div>

          {folders.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">📂</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No folders found
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Record your first video to create folders!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {folders.map((folder: any, index: number) => (
                <div 
                  key={folder.name || index}
                  className={`relative group cursor-pointer rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 ${
                    folder.isMainFolder 
                      ? 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border-2 border-blue-200 dark:border-blue-600'
                      : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {/* Admin Delete Button for Folders */}
                  {userRole === 'admin' && !folder.isMainFolder && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteFolder(folder.uri, folder.name)
                      }}
                      disabled={deletingItems.has(folder.uri.split('/').pop())}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-10"
                      title="Delete Folder"
                    >
                      {deletingItems.has(folder.uri.split('/').pop()) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}

                  <div 
                    onClick={() => openFolder(folder)}
                    className="text-center"
                  >
                    <div className={`text-6xl mb-4 ${
                      folder.isMainFolder ? 'text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      📁
                    </div>
                    
                    <h3 className={`text-lg font-bold mb-2 ${
                      folder.isMainFolder 
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {folder.name}
                    </h3>
                    
                    <div className={`text-sm mb-3 ${
                      folder.isMainFolder 
                        ? 'text-blue-700 dark:text-blue-200'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {folder.videos?.length || 0} videos
                      {folder.customerCount > 0 && (
                        <span className="block">
                          {folder.customerCount} customers
                        </span>
                      )}
                    </div>
                    
                    {folder.isMainFolder && (
                      <div className="inline-block bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-xs font-medium">
                        Main Repository
                      </div>
                    )}
                    
                    <p className={`text-xs mt-3 ${
                      folder.isMainFolder 
                        ? 'text-blue-600 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Click to view videos
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Add Folder Modal */}
      {showAddFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New Folder
              </h3>
              <button
                onClick={() => setShowAddFolderModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search for User
              </label>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-3 text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                  Loading users...
                </div>
              ) : (
                <div className="relative">
                  <input
                    id="userSearch"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Type name or email to search..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={isCreatingFolder}
                    autoComplete="off"
                  />
                  
                  {/* Dropdown */}
                  {showDropdown && filteredUsers.length > 0 && (
                    <div className="user-dropdown absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {user.full_name || user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User'}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* No results message */}
                  {showDropdown && searchQuery && filteredUsers.length === 0 && (
                    <div className="user-dropdown absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3">
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No users found matching "{searchQuery}"
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {selectedUser && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ✅ Selected: <strong>
                      {selectedUser.full_name || selectedUser.display_name || `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username || 'Unknown User'}
                    </strong>
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    Folder will be created: "{selectedUser.full_name || selectedUser.display_name || `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username || 'Unknown User'}"
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddFolderModal(false)}
                disabled={isCreatingFolder}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!selectedUser || isCreatingFolder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {isCreatingFolder && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                )}
                {isCreatingFolder ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Video Modal */}
      {modalVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in fade-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {(() => {
                  const description = modalVideo.description || ''
                  const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
                  return customerMatch ? customerMatch[1].trim() : (modalVideo.customerName || modalVideo.name || 'Video')
                })()}
              </h3>
              <button
                onClick={() => setModalVideo(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-sm opacity-75">Loading video...</p>
                  </div>
                </div>
                
                <iframe
                  src={`https://player.vimeo.com/video/${modalVideo.uri?.split('/').pop()}?autoplay=1&background=0&loop=0&byline=0&portrait=0&title=0&speed=1&transparent=0&gesture=media&playsinline=1&responsive=1`}
                  className="w-full h-full absolute inset-0"
                  allow="autoplay; fullscreen; picture-in-picture; accelerometer; gyroscope"
                  allowFullScreen
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
