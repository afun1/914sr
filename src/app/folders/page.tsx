'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GlobalHeader from '@/components/GlobalHeader'

export default function FoldersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getCurrentUser()
    fetchFolders()
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders')
      if (response.ok) {
        const data = await response.json()
        console.log('📁 API Response:', data)
        
        // Handle different response formats
        let folderArray = []
        if (Array.isArray(data)) {
          folderArray = data
        } else if (Array.isArray(data?.folders)) {
          folderArray = data.folders
        } else if (Array.isArray(data?.data)) {
          folderArray = data.data
        }
        
        console.log('📂 Processed folders:', folderArray.length)
        setFolders(folderArray)
      } else {
        console.error('❌ API response not OK:', response.status)
        setFolders([])
      }
    } catch (error) {
      console.error('❌ Error fetching folders:', error)
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          description: newFolderDescription.trim(),
        }),
      })

      if (response.ok) {
        const newFolder = await response.json()
        setFolders(prev => [newFolder, ...prev])
        setShowCreateModal(false)
        setNewFolderName('')
        setNewFolderDescription('')
      } else {
        console.error('Failed to create folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setCreating(false)
    }
  }

  // Filter and sort folders
  const filteredFolders = folders.filter(folder =>
    (folder.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (folder.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedFolders = [...filteredFolders].sort((a, b) => {
    let aValue = a[sortBy] || ''
    let bValue = b[sortBy] || ''
    
    if (sortBy === 'created_at' || sortBy === 'modified_time') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }
    
    return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1)
  })

  if (loading) {
    return (
      <>
        <GlobalHeader user={currentUser} />
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading folders...</p>
            </div>
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Folder Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and organize your Vimeo folders for better content management
            </p>
          </div>

          {/* Folder Management Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Your Folders
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {folders.length} total folders {searchTerm && `(${filteredFolders.length} filtered)`}
                </span>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  + Create Folder
                </button>
              </div>
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search folders by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="created_at">Date Created</option>
                  <option value="modified_time">Last Modified</option>
                  <option value="name">Name</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>

          {/* Folders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folders.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                <div className="text-6xl mb-4">📁</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No folders found
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first folder to organize your videos
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Create First Folder
                </button>
              </div>
            ) : (
              sortedFolders.map((folder: any, index: number) => (
                <div key={folder.uri || index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-green-600 dark:text-green-300 text-xl">📁</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {folder.name || 'Untitled Folder'}
                        </h3>
                      </div>
                    </div>

                    {folder.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {folder.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                      <span>{folder.video_count || 0} videos</span>
                      <span>
                        {folder.created_time ? new Date(folder.created_time).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => window.open(folder.link, '_blank')}
                        className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        View on Vimeo
                      </button>
                      <button className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Create Folder Modal */}
          {showCreateModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Create New Folder
                  </h3>
                </div>
                
                <div className="px-6 py-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Folder Name *
                    </label>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter folder name..."
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newFolderDescription}
                      onChange={(e) => setNewFolderDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter folder description..."
                    />
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createFolder}
                    disabled={!newFolderName.trim() || creating}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {creating ? 'Creating...' : 'Create Folder'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              About Folders
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Folders help you organize your videos in Vimeo. Create folders for different clients, projects, or video types to keep your content well-organized.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}