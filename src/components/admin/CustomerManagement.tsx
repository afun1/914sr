'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useVimeo } from '@/hooks/useVimeo'
import type { UserRole, Customer } from '@/types/supabase'

interface CustomerManagementProps {
  userRole: UserRole
}

export default function CustomerManagement({ userRole }: CustomerManagementProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'created_at'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<Customer | null>(null)
  const [customerVideos, setCustomerVideos] = useState<any[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const { videos, fetchVideos, loading: vimeoLoading } = useVimeo()

  const isAdmin = userRole === 'admin'

  useEffect(() => {
    fetchCustomers()
  }, [videos]) // Re-fetch when videos change

  useEffect(() => {
    // Initial load - fetch videos if not already loaded
    if (videos.length === 0 && !vimeoLoading) {
      fetchVideos()
    }
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      console.log('🔄 Fetching customers from Vimeo videos...')
      
      // Ensure we have fresh video data
      if (videos.length === 0) {
        console.log('🔄 No videos in state, fetching from Vimeo...')
        await fetchVideos()
      }
      
      console.log(`📋 Processing ${videos.length} videos for customer data`)
      
      // Extract customer information from video descriptions
      const customerMap = new Map()
      const customerStats = new Map() // Track video counts per customer
      
      videos.forEach((video: any) => {
        const description = video.description || ''
        const customerInfo = parseCustomerInfoFromDescription(description)
        
        if (customerInfo.customerName && customerInfo.customerEmail) {
          const customerId = customerInfo.customerEmail.toLowerCase()
          
          // Track video count for this customer
          customerStats.set(customerId, (customerStats.get(customerId) || 0) + 1)
          
          // Use Map to automatically deduplicate by email
          if (!customerMap.has(customerId)) {
            customerMap.set(customerId, {
              id: customerId,
              name: customerInfo.customerName,
              email: customerInfo.customerEmail,
              created_at: video.created_time || new Date().toISOString(),
              phone: '', // Will be filled from localStorage if available
              company: '', // Will be filled from localStorage if available
              videoCount: 0 // Will be set below
            })
          }
        }
      })
      
      // Set video counts
      customerMap.forEach((customer, customerId) => {
        customer.videoCount = customerStats.get(customerId) || 0
      })
      
      const customersFromVimeo = Array.from(customerMap.values())
      console.log(`✅ Extracted ${customersFromVimeo.length} unique customers from Vimeo`)
      
      // Merge with localStorage data for additional fields (phone, company, etc.)
      const storedCustomers = localStorage.getItem('customers')
      if (storedCustomers) {
        const localCustomers = JSON.parse(storedCustomers)
        console.log(`📋 Merging with ${localCustomers.length} customers from localStorage`)
        
        // Enhance Vimeo customers with localStorage data
        customersFromVimeo.forEach(vimeoCustomer => {
          const localMatch = localCustomers.find((local: any) => 
            local.email?.toLowerCase() === vimeoCustomer.email.toLowerCase()
          )
          if (localMatch) {
            vimeoCustomer.phone = localMatch.phone || ''
            vimeoCustomer.company = localMatch.company || ''
          }
        })
        
        // Add localStorage-only customers that don't exist in Vimeo
        localCustomers.forEach((localCustomer: any) => {
          if (!customerMap.has(localCustomer.email?.toLowerCase())) {
            customersFromVimeo.push({
              ...localCustomer,
              videoCount: 0 // No videos in Vimeo for this customer
            })
          }
        })
      }
      
      // Sort by name for better UX
      customersFromVimeo.sort((a, b) => a.name.localeCompare(b.name))
      
      setCustomers(customersFromVimeo)
      console.log(`✅ Loaded ${customersFromVimeo.length} total customers`)
      
    } catch (error) {
      console.error('❌ Error processing customers from Vimeo:', error)
      
      // Fallback to localStorage only
      try {
        const storedCustomers = localStorage.getItem('customers')
        if (storedCustomers) {
          const parsedCustomers: Customer[] = JSON.parse(storedCustomers)
          setCustomers(parsedCustomers)
          console.log('📋 Fallback: loaded customers from localStorage only')
        } else {
          setCustomers([])
          console.log('❌ No customers available')
        }
      } catch (localError) {
        console.error('❌ Error loading from localStorage:', localError)
        setCustomers([])
      }
    } finally {
      setLoading(false)
    }
  }
  
  // Helper function to parse customer info from Vimeo description
  const parseCustomerInfoFromDescription = (description: string) => {
    const customerNameMatch = description.match(/Customer:\s*(.+?)(?:\n|$)/i)
    const customerEmailMatch = description.match(/Email:\s*(.+?)(?:\n|$)/i)
    
    return {
      customerName: customerNameMatch?.[1]?.trim(),
      customerEmail: customerEmailMatch?.[1]?.trim()
    }
  }

  const handleSelectCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers)
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId)
    } else {
      newSelected.add(customerId)
    }
    setSelectedCustomers(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (!isAdmin || selectedCustomers.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedCustomers.size} customer(s)? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      // For now, we'll just remove from localStorage (since customers come from Vimeo videos)
      // In a real app, you'd make API calls to delete from your database
      const storedCustomers = localStorage.getItem('customers')
      if (storedCustomers) {
        const localCustomers = JSON.parse(storedCustomers)
        const filteredCustomers = localCustomers.filter((customer: any) => 
          !selectedCustomers.has(customer.email?.toLowerCase())
        )
        localStorage.setItem('customers', JSON.stringify(filteredCustomers))
      }

      // Refresh the customer list
      await fetchCustomers()
      setSelectedCustomers(new Set())
      
      console.log(`✅ Deleted ${selectedCustomers.size} customers`)
    } catch (error) {
      console.error('❌ Error deleting customers:', error)
      alert('Failed to delete customers. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleViewDetails = async (customer: Customer) => {
    setSelectedCustomerForDetails(customer)
    setLoadingVideos(true)
    
    try {
      // Filter videos for this specific customer
      const customerVideosData = videos.filter(video => {
        const description = video.description || ''
        const customerInfo = parseCustomerInfoFromDescription(description)
        return customerInfo.customerEmail?.toLowerCase() === customer.email.toLowerCase()
      })
      
      // Sort by creation date (newest first)
      customerVideosData.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())
      
      setCustomerVideos(customerVideosData)
    } catch (error) {
      console.error('❌ Error loading customer videos:', error)
      setCustomerVideos([])
    } finally {
      setLoadingVideos(false)
    }
  }

  const closeDetailsModal = () => {
    setSelectedCustomerForDetails(null)
    setCustomerVideos([])
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.company && customer.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      false

    return matchesSearch
  })

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: any = a[sortBy]
    let bValue: any = b[sortBy]
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }
    
    if (!aValue) aValue = ''
    if (!bValue) bValue = ''
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {customers.length} total customers
          </p>
        </div>
        {isAdmin && selectedCustomers.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            {deleting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Deleting...
              </>
            ) : (
              <>
                Delete Selected ({selectedCustomers.size})
              </>
            )}
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search customers by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="created_at">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="email">Sort by Email</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                  {/* No select all - just checkbox column header */}
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Videos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.has(customer.id)}
                      onChange={() => handleSelectCustomer(customer.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {customer.id.slice(0, 8)}...
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{customer.email}</div>
                  {customer.phone && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{customer.phone}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {customer.videoCount || 0} videos
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatDate(customer.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => handleViewDetails(customer)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedCustomers.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No customers found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search criteria.' : 'Customers will appear here when screen recordings are saved.'}
          </p>
        </div>
      )}

      {/* Notes Section */}
      {customers.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Customer Information</h4>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Customers are automatically created when screen recordings are saved. Each customer entry includes their name, email, 
            and any additional notes from recording sessions.
            {!isAdmin && (
              <span className="block mt-2 text-blue-700 dark:text-blue-400 font-medium">
                👀 You have view-only access. Contact an administrator to make changes.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomerForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Customer Details: {selectedCustomerForDetails.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedCustomerForDetails.email}
                </p>
              </div>
              <button
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Customer Info Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-300">Total Videos</h4>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedCustomerForDetails.videoCount || 0}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 dark:text-green-300">Customer Since</h4>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {formatDate(selectedCustomerForDetails.created_at)}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 dark:text-purple-300">Contact Info</h4>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    {selectedCustomerForDetails.phone || 'No phone provided'}
                  </p>
                </div>
              </div>

              {/* Videos List */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Recording History ({customerVideos.length} videos)
                </h4>
                
                {loadingVideos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading videos...</span>
                  </div>
                ) : customerVideos.length > 0 ? (
                  <div className="space-y-3">
                    {customerVideos.map((video, index) => {
                      const description = video.description || ''
                      const recordedByMatch = description.match(/Recorded by:\s*(.+?)(?:\n|$)/i)
                      const notesMatch = description.match(/Additional notes:\s*(.+?)$/i)
                      
                      return (
                        <div key={video.uri} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h5 className="font-medium text-gray-900 dark:text-white">
                                {video.name}
                              </h5>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Recorded: {formatDate(video.created_time)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {formatDuration(video.duration)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {video.status}
                              </p>
                            </div>
                          </div>
                          
                          {recordedByMatch && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                              <span className="font-medium">Recorded by:</span> {recordedByMatch[1]}
                            </p>
                          )}
                          
                          {notesMatch && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Session Notes:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border">
                                {notesMatch[1].trim()}
                              </p>
                            </div>
                          )}
                          
                          <div className="mt-3 flex justify-between items-center">
                            <a
                              href={video.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                            >
                              View Video →
                            </a>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Video #{customerVideos.length - index}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No videos found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      No recordings found for this customer.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={closeDetailsModal}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
