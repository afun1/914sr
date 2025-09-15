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
      const response = await fetch('/api/customers/list')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 API Response:', data)
        
        // Handle different response formats safely
        let customerArray = []
        
        if (Array.isArray(data)) {
          customerArray = data
        } else if (Array.isArray(data?.customers)) {
          customerArray = data.customers
        } else if (Array.isArray(data?.data)) {
          customerArray = data.data
        } else if (data?.users && Array.isArray(data.users)) {
          customerArray = data.users
        }
        
        console.log('👥 Processed customers:', customerArray.length)
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
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
                        // Look for "Recorded by: [Name]" pattern
                        const liaisonMatch = video.description.match(/Recorded by:\s*([^.\n]+)/i)
                        if (liaisonMatch) {
                          liaisonName = liaisonMatch[1].trim()
                        }
                        
                        // Clean up notes by removing all the customer info and system text
                        cleanNotes = video.description
                          .replace(/CUSTOMER INFORMATION:.*?(?=\n|$)/gi, '') // Remove customer info section
                          .replace(/Name:\s*[^.\n]*\.?/gi, '') // Remove name lines
                          .replace(/Email:\s*[^.\n]*\.?/gi, '') // Remove email lines  
                          .replace(/Customer:\s*[^.\n]*\.?/gi, '') // Remove customer lines
                          .replace(/Recorded by:\s*[^.\n]*\.?/gi, '') // Remove recorded by lines
                          .replace(/Screen recording session for.*?\.?/gi, '') // Remove session text
                          .replace(/^\s*com\s+com\s+.*$/gim, '') // Remove "com com" lines
                          .replace(/^\s*[\w\s]*Test\s*\.?\s*$/gim, '') // Remove test-related lines
                          .replace(/^\s*[\n\r]+/gm, '') // Remove empty lines
                          .replace(/^\s+|\s+$/gm, '') // Trim whitespace from each line
                          .split('\n').filter((line: string) => line.trim().length > 0).join('\n') // Remove empty lines
                          .trim()
                      }
                      
                      return (
                        <div key={video.uri || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              {/* Date as the main title */}
                              <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                                📅 {new Date(video.created_time).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </h4>
                              
                              {/* Duration and stats below date */}
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
                              
                              {/* Liaison name if available */}
                              {liaisonName && (
                                <div className="mb-3">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    🤝 <span className="font-medium">Liaison:</span> {liaisonName}
                                  </p>
                                </div>
                              )}
                              
                              {/* Clean notes section - only show if there are actual notes */}
                              {cleanNotes && (
                                <div className="bg-gray-50 dark:bg-gray-600 rounded p-3 mt-2">
                                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
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