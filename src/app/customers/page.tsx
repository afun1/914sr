'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GlobalHeader from '@/components/GlobalHeader'

export default function CustomersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<any>(null)

  useEffect(() => {
    getCurrentUser()
    fetchCustomers()
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      // Use the same API as folders page (which is working)
      const response = await fetch('/api/vimeo/folders')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Folders API Response:', data)
        
        // Extract all videos from all folders (with deduplication)
        const videoMap: { [uri: string]: any } = {}
        
        if (data.folders && Array.isArray(data.folders)) {
          data.folders.forEach((folder: any) => {
            if (folder.videos && Array.isArray(folder.videos)) {
              folder.videos.forEach((video: any) => {
                // Use video URI as key to prevent duplicates
                if (video.uri && !videoMap[video.uri]) {
                  videoMap[video.uri] = video
                }
              })
            }
          })
        }
        
        // Convert to array
        const allVideos = Object.values(videoMap)
        
        console.log('🎥 Total videos found:', allVideos.length)
        
        // Group videos by customer (extract customer name from descriptions)
        const customerGroups: { [customerName: string]: any } = {}
        
        allVideos.forEach((video: any) => {
          const description = video.description || ''
          
          // Extract customer name from description
          let customerName = 'Unknown Customer'
          let customerEmail = ''
          
          // Try different patterns to find customer info
          const customerMatch = description.match(/Customer:\s*([^\n\r]+?)(?:\s+Email:|$)/i)
          const emailMatch = description.match(/Email:\s*([^\n\r]+?)(?:\s+Liaison:|$)/i)
          
          // For simpler formats like "Screen recording for 9131 Test (john+9131@tpnlife.com)"
          const simpleMatch = description.match(/Screen recording for\s+(.+?)\s*\(([^)]+)\)/i)
          
          if (customerMatch) {
            customerName = customerMatch[1].trim()
          } else if (simpleMatch) {
            customerName = simpleMatch[1].trim()
            customerEmail = simpleMatch[2].trim()
          }
          
          if (emailMatch) {
            customerEmail = emailMatch[1].trim()
          }
          
          // Create customer key
          const customerKey = customerEmail || customerName
          
          if (!customerGroups[customerKey]) {
            customerGroups[customerKey] = {
              id: customerKey,
              name: customerName,
              email: customerEmail,
              videos: [],
              videoCount: 0,
              customerSince: video.created_time,
              created_at: video.created_time
            }
          }
          
          // Add video to customer (with deduplication)
          const videoExists = customerGroups[customerKey].videos.some((existingVideo: any) => existingVideo.uri === video.uri)
          if (!videoExists) {
            customerGroups[customerKey].videos.push(video)
            customerGroups[customerKey].videoCount = customerGroups[customerKey].videos.length
          }
          
          // Update earliest date
          if (new Date(video.created_time) < new Date(customerGroups[customerKey].customerSince)) {
            customerGroups[customerKey].customerSince = video.created_time
            customerGroups[customerKey].created_at = video.created_time
          }
        })
        
        // Convert to array
        const customerArray = Object.values(customerGroups)
        
        console.log('👥 Processed customers:', customerArray.length)
        console.log('👥 Customer names:', customerArray.map((c: any) => c.name))
        
        setCustomers(customerArray)
        
      } else {
        console.error('❌ API response not OK:', response.status, response.statusText)
        setCustomers([])
      }
    } catch (error) {
      console.error('❌ Error fetching customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort customers
  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    
    return (
      // Search by customer name
      (customer.name || '').toLowerCase().includes(searchLower) ||
      // Search by email
      (customer.email || '').toLowerCase().includes(searchLower) ||
      // Search by company name if it exists
      (customer.company_name || '').toLowerCase().includes(searchLower) ||
      // Search in video titles
      (customer.videos || []).some((video: any) => 
        (video.name || '').toLowerCase().includes(searchLower)
      ) ||
      // Search in video descriptions
      (customer.videos || []).some((video: any) => 
        (video.description || '').toLowerCase().includes(searchLower)
      )
    )
  })

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue = a[sortBy] || ''
    let bValue = b[sortBy] || ''
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }
    
    return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1)
  })

  // Handle customer selection
  const toggleCustomerSelection = (customerId: string) => {
    const newSelected = new Set(selectedCustomers)
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId)
    } else {
      newSelected.add(customerId)
    }
    setSelectedCustomers(newSelected)
  }

  // Handle view details modal
  const handleViewDetails = (customer: any) => {
    setSelectedCustomerDetails(customer)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedCustomerDetails(null)
  }

  if (loading) {
    return (
      <>
        <GlobalHeader user={currentUser} />
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading customers...</p>
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
            <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              Customer Directory
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View customer information and recording history
            </p>
          </div>

          {/* Customer Management Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Customer Management
              </h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {customers.length} total customers {searchTerm && `(${filteredCustomers.length} filtered)`}
              </span>
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by customer name, email, or video content..."
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
                  <option value="created_at">Date</option>
                  <option value="name">Name</option>
                  <option value="email">Email</option>
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

          {/* Customer Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      {/* Empty header for checkbox column */}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Videos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center">
                        <div className="text-6xl mb-4">🏢</div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          No customers found
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                          No customers have been created yet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    sortedCustomers.map((customer: any, index: number) => (
                      <tr key={customer.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedCustomers.has(customer.id)}
                            onChange={() => toggleCustomerSelection(customer.id)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {customer.name || customer.full_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {customer.email || 'No email'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                            {customer.videoCount || customer.video_count || customer.videos || 0} videos
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {customer.customerSince || customer.created_at ? new Date(customer.customerSince || customer.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => handleViewDetails(customer)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 underline cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Customer Information
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Customers are automatically created when screen recordings are saved. Each customer entry includes their name, email, and any additional notes from recording sessions.
            </p>
          </div>

          {/* Customer Details Modal */}
          {showModal && selectedCustomerDetails && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={closeModal}
            >
              <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedCustomerDetails.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {selectedCustomerDetails.email}
                    </p>
                  </div>
                  <div className="flex flex-col text-right text-sm text-gray-500 dark:text-gray-400 mr-8">
                    <span>{selectedCustomerDetails.videoCount} videos</span>
                    <span>Customer since: {new Date(selectedCustomerDetails.customerSince).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl ml-4"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
                  <div className="space-y-4">
                    {selectedCustomerDetails.videos?.map((video: any, index: number) => {
                      // Clean up video title by removing "Screen Recording" and similar text
                      const cleanTitle = video.name 
                        ?.replace(/^.+?\s*-\s*Screen Recording.*$/i, '') // Remove "Customer Name - Screen Recording..."
                        ?.replace(/Screen Recording.*$/i, '') // Remove any remaining "Screen Recording" text
                        ?.replace(/Recording.*$/i, '') // Remove "Recording" text
                        ?.trim() || 'Screen Recording'
                      
                      // Extract liaison name from description
                      let liaisonName = ''
                      let cleanNotes = ''
                      
                      if (video.description) {
                        // Extract liaison name from "Recorded by:" pattern
                        const recordedByMatch = video.description.match(/Recorded by:\s*([^\n\r]+?)(?:\s+Timestamp:|$)/)
                        if (recordedByMatch) {
                          liaisonName = recordedByMatch[1].trim()
                        }
                        
                        // Extract comments - try multiple methods
                        const lines = video.description.split('\n')
                        let comments = ''
                        
                        // Method 1: Look for content after "Timestamp:" line (structured format)
                        const timestampLineIndex = lines.findIndex((line: string) => 
                          line.includes('Timestamp:')
                        )
                        
                        if (timestampLineIndex >= 0 && timestampLineIndex < lines.length - 1) {
                          const afterTimestamp = lines.slice(timestampLineIndex + 1).join('\n').trim()
                          if (afterTimestamp && afterTimestamp.length > 5) {
                            comments = afterTimestamp
                            if (comments.startsWith('Notes:')) {
                              comments = comments.substring(6).trim()
                            }
                          }
                        } else {
                          // Method 2: For simpler formats, look for content after the main description line
                          // Skip the first line (which has customer info) and take everything else as comments
                          if (lines.length > 1) {
                            const potentialComments = lines.slice(1).join('\n').trim()
                            
                            // Filter out structured metadata lines
                            const filteredLines = lines.slice(1).filter((line: string) => {
                              const trimmedLine = line.trim()
                              // Skip lines that contain metadata patterns
                              return !trimmedLine.match(/^(Email:|Liaison:|Recorded:)/i) && 
                                     trimmedLine.length > 0
                            })
                            
                            const comments = filteredLines.join('\n').trim()
                            
                            // Check if it contains meaningful content (not just empty or very short)
                            if (comments && comments.length > 5) {
                              cleanNotes = comments
                            }
                          }
                        }
                      }
                      
                      // If no liaison found, assume it's John Bradshaw for now (since he's recording)
                      if (!liaisonName) {
                        liaisonName = 'John Bradshaw'
                      }
                      
                      return (
                        <div key={video.uri || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              {/* Recorded by and Date in 2 columns */}
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="font-semibold text-lg text-gray-900 dark:text-white">
                                  🤝 Recorded by {liaisonName}
                                </h4>
                                <div className="font-semibold text-lg text-gray-900 dark:text-white">
                                  📅 {new Date(video.created_time).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric', 
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </div>
                              
                              {/* Duration and stats below header */}
                              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                                <span>⏱️ {Math.round(video.duration / 60)} minutes</span>
                                <span>👀 {video.stats?.plays || 0} views</span>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  video.privacy?.view === 'anybody' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 
                                  video.privacy?.view === 'password' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                                  'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                }`}>
                                  {video.privacy?.view === 'anybody' ? 'Public' : 
                                   video.privacy?.view === 'password' ? 'Password Protected' : 'Private'}
                                </span>
                              </div>
                              
                              {/* Clean notes section - only show if there are actual notes */}
                              {cleanNotes && (
                                <div className="bg-gray-50 dark:bg-gray-600 rounded p-3 mt-2 w-full overflow-hidden" style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-all word-break-break-all overflow-wrap-anywhere max-w-full" style={{wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap'}}>
                                    💬 <span className="font-medium">Notes:</span> {cleanNotes}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <div className="ml-4 flex flex-col gap-2">
                              <a
                                href={video.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                              >
                                🎬 View Video
                              </a>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {!selectedCustomerDetails.videos?.length && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No video details available
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
