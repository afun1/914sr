// Let me find the correct folders page component and add the button there
// First, let me create a proper folder management component with the Add Folder button

'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'

export default function FolderManager() {
  const [showAddFolderModal, setShowAddFolderModal] = useState(false)
  const [folderSearchTerm, setFolderSearchTerm] = useState('')
  const [selectedUserForFolder, setSelectedUserForFolder] = useState(null)
  const [isDropdownOpenFolder, setIsDropdownOpenFolder] = useState(false)
  const [users, setUsers] = useState([])
  const [effectiveRole, setEffectiveRole] = useState('user')

  // Get current user role for admin check
  useEffect(() => {
    const checkUserRole = async () => {
      // You can integrate this with your existing role detection logic
      const userEmail = 'john@tpnlife.com' // Replace with actual current user detection
      if (userEmail === 'john@tpnlife.com') {
        setEffectiveRole('admin')
      }
    }
    checkUserRole()
    fetchUsers()
  }, [])

  // Fetch users for the dropdown
  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('email', { ascending: true })
      
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  // Handle creating folder for selected user
  const handleCreateFolder = async () => {
    if (!selectedUserForFolder) return
    
    try {
      const response = await fetch('/api/folders/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user-folder',
          userEmail: selectedUserForFolder.email,
          displayName: selectedUserForFolder.display_name || selectedUserForFolder.email?.split('@')[0]
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ Folder created successfully! 

User: ${selectedUserForFolder.display_name || selectedUserForFolder.email}
Videos imported: ${result.videosImported || 0}

They can now see their videos in "Your Recordings"!`)
        setShowAddFolderModal(false)
        setSelectedUserForFolder(null)
        setFolderSearchTerm('')
      } else {
        alert(`❌ Error creating folder: ${result.error}`)
      }
      
    } catch (error) {
      console.error('Error creating folder:', error)
      alert('Failed to create folder')
    }
  }

  // Get users for folder creation dropdown
  const getAvailableUsersForFolder = () => {
    return users.filter(user => 
      user.email?.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
      `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(folderSearchTerm.toLowerCase())
    )
  }

  const refreshFolders = () => {
    // Your existing refresh logic
    window.location.reload()
  }

  const removeDuplicates = () => {
    // Your existing remove duplicates logic
    console.log('Remove duplicates clicked')
  }

  return (
    <div>
      {/* Button Bar */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={refreshFolders}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        
        {/* Admin-only Add Folder Button */}
        {effectiveRole === 'admin' && (
          <button
            onClick={() => setShowAddFolderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Folder
          </button>
        )}
        
        <button
          onClick={removeDuplicates}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          <Trash2 className="h-4 w-4" />
          No Duplicates
        </button>
      </div>

      {/* Add Folder Modal */}
      {showAddFolderModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Create User Folder
                </h3>
                <button
                  onClick={() => {
                    setShowAddFolderModal(false)
                    setSelectedUserForFolder(null)
                    setFolderSearchTerm('')
                    setIsDropdownOpenFolder(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a user to create a folder for their videos in the folder manager.
              </p>

              {/* User Search with Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search for User:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={folderSearchTerm}
                    onChange={(e) => setFolderSearchTerm(e.target.value)}
                    onFocus={() => setIsDropdownOpenFolder(true)}
                    onBlur={() => {
                      setTimeout(() => setIsDropdownOpenFolder(false), 150)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  
                  {/* Dropdown Results */}
                  {isDropdownOpenFolder && !selectedUserForFolder && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {getAvailableUsersForFolder().length === 0 ? (
                        <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                          {folderSearchTerm ? 
                            `No users found matching "${folderSearchTerm}"` :
                            `Type to search for users`
                          }
                        </div>
                      ) : (
                        getAvailableUsersForFolder().map((user) => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setSelectedUserForFolder(user)
                              setFolderSearchTerm(user.display_name || user.email || '')
                              setIsDropdownOpenFolder(false)
                            }}
                            className="p-3 cursor-pointer border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.display_name || user.email}
                            </div>
                            {user.display_name && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.email}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected User Display */}
                {selectedUserForFolder && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900 rounded-md">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Selected User:
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {selectedUserForFolder.display_name || selectedUserForFolder.email}
                      {selectedUserForFolder.display_name && (
                        <span className="ml-1 text-xs">({selectedUserForFolder.email})</span>
                      )}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedUserForFolder(null)
                        setFolderSearchTerm('')
                      }}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 mt-1"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={handleCreateFolder}
                disabled={!selectedUserForFolder}
                className={`flex-1 py-2 px-4 rounded-md focus:ring-2 focus:ring-offset-2 ${
                  selectedUserForFolder
                    ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                }`}
              >
                Create Folder
              </button>
              
              <button
                onClick={() => {
                  setShowAddFolderModal(false)
                  setSelectedUserForFolder(null)
                  setFolderSearchTerm('')
                  setIsDropdownOpenFolder(false)
                }}
                className="py-2 px-4 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Your existing folder content goes here */}
      <div>
        {/* Existing folder manager content */}
      </div>
    </div>
  )
}