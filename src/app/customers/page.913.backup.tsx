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

          {/* Customer Table and Modal with perfect layout */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Video Count
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer Since
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {customer.videoCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(customer.customerSince).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <button
                          onClick={() => handleViewDetails(customer)}
                          className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination (if needed) */}
            {/* <div className="mt-4">
              <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Previous
              </button>
              <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Next
              </button>
            </div> */}
          </div>

          {/* Customer Details Modal */}
          {showModal && selectedCustomerDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full p-6">
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Customer Details
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    &times;
                  </button>
                </div>

                {/* Modal Content - 2-column layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Customer Information
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Name:</span> {selectedCustomerDetails.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Email:</span> {selectedCustomerDetails.email}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Customer Since:</span> {new Date(selectedCustomerDetails.customerSince).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Video Statistics
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Total Videos:</span> {selectedCustomerDetails.videoCount}
                    </p>
                    {/* Add more statistics as needed */}
                  </div>
                </div>

                {/* Video Thumbnails */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recorded Videos
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {selectedCustomerDetails.videos.map((video: any) => (
                      <div key={video.uri} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {video.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(video.created_time).toLocaleDateString()}
                        </p>
                        <div className="mt-2">
                          <a
                            href={video.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Recording
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-4">
                  <button
                    onClick={closeModal}
                    className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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