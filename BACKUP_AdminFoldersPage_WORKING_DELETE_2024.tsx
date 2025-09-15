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
  const [showAddFolderModal, setShowAddFolderModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    getCurrentUser()
    fetchFolders()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('#userSearch') && !target.closest('.user-dropdown')) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

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

  const fetchFolders = async () => {
    try {
      setLoading(true)
      console.log('🔄 Fetching folders from Vimeo API...')
      
      // Get Vimeo folders only
      const vimeoResponse = await fetch('/api/vimeo/folders')
      
      const allFolders: any[] = []
      
      // Add Vimeo folders (main repository)
      if (vimeoResponse.ok) {
        const vimeoData = await vimeoResponse.json()
        console.log('📁 Vimeo folders:', vimeoData.folders?.length || 0)
        allFolders.push(...(vimeoData.folders || []))
      }
      
      console.log('📁 Total folders:', allFolders.length)
      
      // Log each folder being processed
      allFolders.forEach((folder: any, index: number) => {
        console.log(`📁 Processing folder ${index + 1}: "${folder.name}" (URI: ${folder.uri})`)
      })
      
      // Process folders for display
      const processedFolders = allFolders.map((folder: any) => ({
        ...folder,
        isMainFolder: /team.*library/i.test(folder.name || '') || /sparky.*screen.*recording/i.test(folder.name || ''),
        customerCount: folder.videos ? new Set(folder.videos.map((v: any) => {
          const description = v.description || ''
          const customerMatch = description.match(/Customer: ([^\n\r]+?)(?:\s+Email:|$)/)
          return customerMatch ? customerMatch[1].trim() : (v.customerName || v.name || 'Unknown')
        })).size : 0
      }))
      
      console.log('📁 Final processed folders count:', processedFolders.length)
      setFolders(processedFolders)
    } catch (error) {
      console.error('Error fetching folders:', error)
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, first_name, last_name, display_name, username')
        .order('full_name')

      if (error) {
        console.error('❌ Error fetching users:', error)
        return
      }

      console.log('👥 Raw user data:', data) // Debug log to see what we're getting
      setUsers(data || [])
      setFilteredUsers(data || [])
      console.log('👥 Loaded users:', data?.length || 0)
    } catch (error) {
      console.error('❌ Error fetching users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowDropdown(true)
    
    if (!value.trim()) {
      setFilteredUsers(users)
      setSelectedUser(null)
      return
    }

    const filtered = users.filter(user => {
      const searchTerm = value.toLowerCase()
      
      // Search across multiple name and email fields
      const fullName = (user.full_name || '').toLowerCase()
      const firstName = (user.first_name || '').toLowerCase()
      const lastName = (user.last_name || '').toLowerCase()
      const displayName = (user.display_name || '').toLowerCase()
      const username = (user.username || '').toLowerCase()
      const email = (user.email || '').toLowerCase()
      
      return fullName.includes(searchTerm) || 
             firstName.includes(searchTerm) || 
             lastName.includes(searchTerm) ||
             displayName.includes(searchTerm) ||
             username.includes(searchTerm) ||
             email.includes(searchTerm)
    })
    
    console.log(`🔍 Searching for "${value}" found ${filtered.length} results`)
    setFilteredUsers(filtered)
  }

  const handleUserSelect = (user: any) => {
    setSelectedUser(user)
    const displayName = user.full_name || user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User'
    setSearchQuery(`${displayName} (${user.email})`)
    setShowDropdown(false)
  }

  const handleOpenAddFolderModal = () => {
    setShowAddFolderModal(true)
    setSearchQuery('')
    setSelectedUser(null)
    setShowDropdown(false)
    fetchUsers() // Load users when modal opens
  }

  const handleCreateFolder = async () => {
    if (!selectedUser || !searchQuery.trim()) return

    // Extract folder name from the user - use the best available name
    const folderName = selectedUser.full_name || 
                      selectedUser.display_name || 
                      `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() ||
                      selectedUser.username || 
                      'Unknown User'

    setIsCreatingFolder(true)
    
    try {
      const response = await fetch('/api/vimeo/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          userId: selectedUser.id
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Folder created:', result)
        
        // Reset modal
        setShowAddFolderModal(false)
        setSearchQuery('')
        setSelectedUser(null)
        
        // Wait a moment then refresh folders list to ensure the new folder is picked up
        console.log('🔄 Refreshing folders list...')
        setTimeout(() => {
          fetchFolders()
        }, 1500) // Wait 1.5 seconds for Vimeo to process
        
        // Also refresh immediately
        fetchFolders()
      } else {
        const error = await response.json()
        console.error('❌ Failed to create folder:', error)
        alert('Failed to create folder: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Error creating folder:', error)
      alert('Error creating folder: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsCreatingFolder(false)
    }
  }

  // ✅ WORKING VIDEO DELETE FUNCTION - Uses query parameter API route
  const handleDeleteVideo = async (videoUri: string, videoName: string) => {
    if (!confirm(`Are you sure you want to delete the video "${videoName}"? This action cannot be undone.`)) {
      return
    }

    const videoId = videoUri.split('/').pop()
    setDeletingItems(prev => new Set([...prev, videoId]))

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
      setDeletingItems(prev => {
        const updated = new Set(prev)
        updated.delete(videoId)
        return updated
      })
    }
  }

  // ✅ WORKING FOLDER DELETE FUNCTION - Uses query parameter API route
  const handleDeleteFolder = async (folderUri: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and ALL its videos? This action cannot be undone.`)) {
      return
    }

    const folderId = folderUri.split('/').pop()
    console.log('🗑️ Attempting to delete folder:', folderId, 'from URI:', folderUri)
    setDeletingItems(prev => new Set([...prev, folderId]))

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
      setDeletingItems(prev => {
        const updated = new Set(prev)
        updated.delete(folderId)
        return updated
      })
    }
  }

  // ...existing JSX code continues unchanged...
}