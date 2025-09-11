'use client'

import { useState, useEffect } from 'react'
import GlobalHeader from '@/components/GlobalHeader'
import { supabase } from '@/lib/supabase'

export default function FoldersPage() {
  const [folders, setFolders] = useState<any[]>([])
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [folderVideos, setFolderVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [videosLoading, setVideosLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [error, setError] = useState('')
  
  // User search dropdown states
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [creatingFolder, setCreatingFolder] = useState(false)

  useEffect(() => {
    fetchFolders()
    getCurrentUser()
    fetchAllUsers()
  }, [])

  const fetchAllUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('display_name')
      
      if (error) {
        console.error('Error fetching users:', error)
        return
      }
      
      setAllUsers(users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    
    if (value.length > 0) {
      const filtered = allUsers.filter((user: any) => 
        user.display_name?.toLowerCase().includes(value.toLowerCase()) ||
        user.email?.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestedUsers(filtered.slice(0, 5)) // Limit to 5 suggestions
    } else {
      setSuggestedUsers([])
    }
  }

  const createSimpleFolder = async (folderName: string) => {
    try {
      setCreatingFolder(true)
      console.log(`Creating simple folder: ${folderName}`)
      
      const response = await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: folderName
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ Folder "${folderName}" created successfully!

You can now manually move videos to this folder as needed.`)
        
        refreshFolders()
      } else {
        alert(`❌ Error: ${result.error}`)
      }
      
    } catch (error) {
      alert('Failed to create folder')
      console.error('Error creating folder:', error)
    } finally {
      setCreatingFolder(false)
    }
  }

  const createFolderForUser = async (userEmail: string, displayName: string) => {
    try {
      setCreatingFolder(true)
      console.log(`Creating folder for: ${displayName} (${userEmail})`)
      
      const response = await fetch('/api/folders/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user-folder',
          userEmail: userEmail,
          displayName: displayName
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ Folder created successfully!

User: ${displayName}
Videos imported: ${result.videosImported || 0}

They can now see their videos in "Your Recordings"!`)
        
        // Clear search and refresh
        setShowUserSearch(false)
        setSearchTerm('')
        setSuggestedUsers([])
        refreshFolders()
        fetchAllUsers() // Refresh user list
      } else {
        alert(`❌ Error: ${result.error}`)
      }
      
    } catch (error) {
      alert('Failed to create folder')
      console.error('Error creating folder:', error)
    } finally {
      setCreatingFolder(false)
    }
  }

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user as any)
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const fetchFolders = async () => {
    try {
      setLoading(true)
      setError('')
      console.log('🔄 Fetching folders...')
      
      const response = await fetch('/api/vimeo/folders')
      console.log('📡 Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📁 Folders data:', data)
        setFolders(data.folders || [])
      } else {
        const errorText = await response.text()
        setError(`API Error: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('Error fetching folders:', error)
      setError(`Network Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchFolderVideos = async (folderId: string, folderName: string) => {
    try {
      setVideosLoading(true)
      console.log(`📹 Fetching videos from folder: ${folderName}`)
      
      const response = await fetch(`/api/vimeo/folders/${folderId}/videos`)
      if (response.ok) {
        const data = await response.json()
        setFolderVideos(data.videos || [])
        setSelectedFolder({ id: folderId, name: folderName } as any)
      }
    } catch (error) {
      console.error('Error fetching folder videos:', error)
    } finally {
      setVideosLoading(false)
    }
  }

  const refreshFolders = () => {
    fetchFolders()
    setSelectedFolder(null)
    setFolderVideos([])
  }

  const removeDuplicates = () => {
    console.log('Remove duplicates functionality')
  }

  return (
    <>
      {currentUser && <GlobalHeader user={currentUser} />}
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Folder Manager
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedFolder ? `Videos in ${selectedFolder.name}` : 'Manage your Vimeo folders and organization'}
                </p>
              </div>
              {selectedFolder && (
                <button
                  onClick={() => {
                    setSelectedFolder(null)
                    setFolderVideos([])
                  }}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  ← Back to Folders
                </button>
              )}
            </div>

            <div className="flex gap-4 mb-6">
              <button 
                onClick={refreshFolders}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
              
              {/* Smart Add Folder Button with Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  disabled={creatingFolder}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {creatingFolder ? 'Creating...' : 'Add Folder'}
                </button>
                
                {/* Search Dropdown */}
                {showUserSearch && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50">
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Create Folder for User
                      </h3>
                      
                      {/* Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search by name or email..."
                          value={searchTerm}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-600 dark:text-white"
                          autoFocus
                        />
                        <svg className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      
                      {/* Suggestions */}
                      {suggestedUsers.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Existing users:</p>
                          {suggestedUsers.map((user: any, index) => (
                            <button
                              key={index}
                              onClick={() => createFolderForUser(user.email, user.display_name)}
                              disabled={creatingFolder}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.display_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.email}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Quick Add Known Users */}
                      {searchTerm.length === 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick create (simple folders):</p>
                          <button
                            onClick={() => createSimpleFolder('Nicolaas Knook - Screen Recordings')}
                            disabled={creatingFolder}
                            className="w-full text-left px-3 py-2 rounded-md bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-800 disabled:opacity-50 mb-2"
                          >
                            <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                              Create Nicolaas Folder (Simple)
                            </div>
                            <div className="text-xs text-purple-600 dark:text-purple-400">
                              Just creates the Vimeo folder - no user management
                            </div>
                          </button>
                          <button
                            onClick={() => createFolderForUser('nicolaas.phg@checkcas.com', 'Nicolaas Knook')}
                            disabled={creatingFolder}
                            className="w-full text-left px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 disabled:opacity-50 mb-2"
                          >
                            <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Create Nicolaas Folder (Full Setup)
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              nicolaas.phg@checkcas.com + database + auto-move
                            </div>
                          </button>
                        </div>
                      )}
                      
                      {/* Manual Entry */}
                      {searchTerm.length > 0 && suggestedUsers.length === 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Create new user:</p>
                          <button
                            onClick={() => {
                              // Use Nicolaas's actual email if searching for him
                              const isNicolaas = searchTerm.toLowerCase().includes('nicolaas')
                              const email = searchTerm.includes('@') ? searchTerm : 
                                           isNicolaas ? 'nicolaas.phg@checkcas.com' : 
                                           `${searchTerm}@gmail.com`
                              const name = searchTerm.includes('@') ? searchTerm.split('@')[0] : searchTerm
                              createFolderForUser(email, name)
                            }}
                            disabled={creatingFolder}
                            className="w-full text-left px-3 py-2 rounded-md bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-800 disabled:opacity-50"
                          >
                            <div className="text-sm font-medium text-green-800 dark:text-green-200">
                              Create folder for "{searchTerm}"
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              {searchTerm.includes('@') ? searchTerm : 
                               searchTerm.toLowerCase().includes('nicolaas') ? 'nicolaas.phg@checkcas.com' : 
                               `${searchTerm}@gmail.com`}
                            </div>
                          </button>
                        </div>
                      )}
                      
                      {/* Close Button */}
                      <button
                        onClick={() => {
                          setShowUserSearch(false)
                          setSearchTerm('')
                          setSuggestedUsers([])
                        }}
                        className="mt-3 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                onClick={removeDuplicates}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                🧹 No Duplicates
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              {selectedFolder ? (
                /* Videos View */
                videosLoading ? (
                  <p className="text-gray-600 dark:text-gray-300">Loading videos...</p>
                ) : folderVideos.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {folderVideos.map((video: any, index) => (
                      <div key={index} className="bg-white dark:bg-gray-600 p-4 rounded-lg shadow">
                        {video.thumbnail && (
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-32 object-cover rounded mb-3"
                          />
                        )}
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                          {video.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Duration: {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Created: {video.created_time ? new Date(video.created_time).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">No videos found in this folder</p>
                )
              ) : (
                /* Folders View */
                loading ? (
                  <p className="text-gray-600 dark:text-gray-300">Loading folders...</p>
                ) : folders.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {folders.map((folder: any, index) => (
                      <div 
                        key={index} 
                        onClick={() => fetchFolderVideos(folder.id, folder.name)}
                        className={`p-4 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow ${
                          folder.is_main_folder 
                            ? 'bg-green-50 dark:bg-green-900 border-2 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-800'
                            : 'bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h3 className={`font-semibold ${
                            folder.is_main_folder 
                              ? 'text-green-800 dark:text-green-200'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {folder.is_main_folder && '⭐ '}
                            {folder.name || `Folder ${index + 1}`}
                          </h3>
                          {folder.is_main_folder && (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                              MAIN
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${
                          folder.is_main_folder 
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-gray-600 dark:text-gray-300'
                        }`}>
                          {folder.description || 'Screen recordings folder'}
                        </p>
                        {folder.video_count !== undefined && (
                          <p className={`text-xs mt-2 ${
                            folder.is_main_folder 
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {folder.video_count} videos • Click to view
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      No folders found
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click Refresh to load folders or check your folder source
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}