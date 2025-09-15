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
            console.log('📁 Liaison folder', name, email, 'matched videos:', matchedVideos.length)
            // Store email separately so we can render it on the second line
            return { name, email, uri: `local://liaison/${p.id}`, isMainFolder: false, videos: matchedVideos, customerCount: new Set(matchedVideos.map((mv: any) => (mv.name || mv.customerName || 'Unknown'))).size }
          })
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
    if (!confirm(`Are you sure you want to delete the video "${videoName}"?`)) return
    const videoId = getIdFromUri(videoUri)
    if (videoId) setDeletingItems(prev => new Set([...Array.from(prev), videoId]))
    try {
      const res = await fetch(`/api/vimeo/videos?delete=${videoId}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.text(); throw new Error(err) }
      if (selectedFolder) setSelectedFolder((prev: any) => ({ ...prev, videos: (prev.videos || []).filter((v: any) => v.uri !== videoUri) }))
      fetchFolders()
    } catch (err) { console.error('delete video err', err); alert('Failed to delete video') }
    finally { if (videoId) setDeletingItems(prev => { const s = new Set(prev); s.delete(videoId); return s }) }
  }

  const handleDeleteFolder = async (folderUri: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and ALL its videos? This action cannot be undone.`)) {
      return
    }

    const folderId = getIdFromUri(folderUri)
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
          <div className="container mx-auto px-4 py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4">Loading folders...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <GlobalHeader user={currentUser} />
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Video Folders</h1>

          <div className="mb-6">
            <div className="relative">
              <input
                id="userSearch"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full px-4 py-2 rounded-lg"
              />
              {showDropdown && filteredUsers.length > 0 && (
                <div className="absolute z-10 w-full bg-white rounded-lg shadow user-dropdown">
                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleUserSelect(u)}
                      className="py-2 px-3 hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="font-medium">{u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!selectedFolder ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {folders.map((folder, idx) => (
                <div key={folder.uri || folder.name || idx} onClick={() => openFolder(folder)} className={`p-6 rounded shadow cursor-pointer ${folder.isMainFolder ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className="text-2xl mb-2">📁</div>
                  <h3 className="font-bold mb-1">{folder.name}</h3>
                  {folder.email ? <div className="text-sm text-gray-500 mb-2">{folder.email}</div> : null}
                  <div className="text-sm text-gray-600">{(folder.videos || []).length} videos{folder.customerCount ? ` • ${folder.customerCount} customers` : ''}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => setSelectedFolder(null)} className="text-blue-600 mb-4">Back to folders</button>
              <h2 className="text-2xl font-bold mb-1">{selectedFolder.name}</h2>
              {selectedFolder.email ? <div className="text-sm text-gray-500 mb-2">{selectedFolder.email}</div> : null}
              
              <p className="text-sm text-gray-600 mb-4">{(selectedFolder.videos || []).length} videos</p>

              {selectedFolder.videos && selectedFolder.videos.length > 0 ? (
                <div className="grid grid-cols-6 gap-4">
                  {selectedFolder.videos.map((video: any, i: number) => (
                    <div key={video.uri || i} className="group">
                      <div className="aspect-video bg-gray-200 rounded overflow-hidden relative mb-2">
                        {video.pictures?.sizes?.length ? <img src={video.pictures.sizes[0].link} alt={video.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400">🎥</div>}

                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingMeta(null); setModalVideo(video) }} className="absolute inset-0 flex items-center justify-center cursor-pointer">
                          <div className="bg-white p-2 rounded opacity-0 group-hover:opacity-100">▶</div>
                        </div>

                        {userRole === 'admin' && (
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100">
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenEditMeta(video) }} className="bg-yellow-500 text-white p-1 rounded">✎</button>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteVideo(video.uri, (video.name || 'Video')) }} className="bg-red-600 text-white p-1 rounded">🗑</button>
                          </div>
                        )}
                      </div>

                      <div className="p-2">
                        <h4 className="text-xs font-medium truncate">{getVideoMeta(video).customerName || video.name || 'Unknown'}</h4>
                        <div className="text-xs text-gray-500 truncate">{getVideoMeta(video).customerEmail || ''}</div>
                        <div className="text-xs text-blue-600 truncate">{getVideoMeta(video).liaisonName || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No videos found in this folder.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      {modalVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-end p-3 border-b">
              <button onClick={() => { setModalVideo(null); setEditingMeta(null) }} className="p-2">Close</button>
            </div>

            <div className="p-4">
              <div className="aspect-video bg-black rounded overflow-hidden mb-4">
                <iframe src={`https://player.vimeo.com/video/${modalVideo?.uri?.split('/').pop()}?responsive=1`} className="w-full h-full" allow="autoplay; fullscreen" />
              </div>

              <div className="grid grid-cols-12 gap-4 text-sm">
                <div className="col-span-6">
                  <h3 className="text-lg font-semibold">{getVideoMeta(modalVideo).customerName || modalVideo.name}</h3>
                  <div className="text-xs text-gray-600">{getVideoMeta(modalVideo).customerEmail || ''}</div>
                  <div className="text-xs text-blue-600">{getVideoMeta(modalVideo).liaisonName || ''}</div>
                  <div className="text-xs text-gray-500 mt-2">{getVideoMeta(modalVideo).recordedTime || ''}</div>
                </div>

                <div className="col-span-6">
                  {editingMeta ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs">Customer Name</label>
                        <input value={editingMeta.customerName} onChange={(e) => setEditingMeta({ ...editingMeta, customerName: e.target.value })} className="w-full px-2 py-1 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs">Customer Email</label>
                        <input value={editingMeta.customerEmail} onChange={(e) => setEditingMeta({ ...editingMeta, customerEmail: e.target.value })} className="w-full px-2 py-1 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs">Liaison Name</label>
                        <input value={editingMeta.liaisonName} onChange={(e) => setEditingMeta({ ...editingMeta, liaisonName: e.target.value })} className="w-full px-2 py-1 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs">Liaison Email</label>
                        <input value={editingMeta.liaisonEmail} onChange={(e) => setEditingMeta({ ...editingMeta, liaisonEmail: e.target.value })} className="w-full px-2 py-1 border rounded" />
                      </div>
                      <div>
                        <label className="block text-xs">Comments</label>
                        <textarea value={editingMeta.comments} onChange={(e) => setEditingMeta({ ...editingMeta, comments: e.target.value })} className="w-full px-2 py-1 border rounded h-28" />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button onClick={handleCancelEditMeta} disabled={savingMeta} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
                        <button onClick={handleSaveMeta} disabled={savingMeta} className="px-3 py-1 bg-green-600 text-white rounded">{savingMeta ? 'Saving...' : 'Save'}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-auto bg-gray-50 p-3 rounded border">{getVideoMeta(modalVideo).comments || <span className="text-gray-400 italic">No comments</span>}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
