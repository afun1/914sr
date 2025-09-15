// filepath: c:\sr97\src\app\page-simple.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import GlobalHeader from '@/components/GlobalHeader'
import { supabase } from '@/lib/supabase'

export default function RecordingPage() {
  // Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // User and customer states
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [searchCustomerText, setSearchCustomerText] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing')

  // New customer form
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [recordingDescription, setRecordingDescription] = useState('')

  // Upload states
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    getCurrentUser()
  }, [])

  useEffect(() => {
    console.log('🔄 useEffect triggered - currentUser:', currentUser)
    if (currentUser) {
      console.log('✅ Current user exists, calling fetchCustomers')
      fetchCustomers()
    } else {
      console.log('⏳ Current user is null, waiting...')
    }
  }, [currentUser])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('👤 getCurrentUser result:', user)
      setCurrentUser(user)
      console.log('✅ currentUser state set to:', user)
      
      // Call fetchCustomers directly after setting user
      if (user) {
        console.log('🚀 Calling fetchCustomers directly from getCurrentUser')
        await fetchCustomers()
      }
    } catch (error) {
      console.error('Error getting current user:', error)
      setCurrentUser(null)
    }
  }

  const fetchCustomers = async () => {
    console.log('🚀 fetchCustomers function called')
    if (!currentUser) {
      console.log('⏳ Waiting for user authentication...')
      return
    }

    try {
      console.log('🔄 Loading customers from Vimeo...')

      const response = await fetch('/api/vimeo/folders?t=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })

      console.log('📡 API response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('📊 Folders API Response:', data)

        const allVideos: any[] = []
        if (data.folders && Array.isArray(data.folders)) {
          data.folders.forEach((folder: any) => {
            if (folder.videos && Array.isArray(folder.videos)) {
              folder.videos.forEach((video: any) => {
                if (video.uri && !allVideos.find(v => v.uri === video.uri)) {
                  allVideos.push(video)
                }
              })
            }
          })
        }

        console.log('🎥 Total videos found:', allVideos.length)

        if (allVideos.length === 0) {
          console.log('⚠️ No videos found - customers dropdown will be empty')
        }

        // Group videos by customer
        const customerGroups: { [customerName: string]: any } = {}

        allVideos.forEach((video: any) => {
          const description = video.description || ''
          let customerName = 'Unknown Customer'
          let customerEmail = ''

          const customerMatch = description.match(/Customer:\s*([^\n\r]+?)(?:\s+Email:|$)/i)
          const simpleMatch = description.match(/Screen recording for\s+(.+?)\s*\(([^)]+)\)/i)

          if (customerMatch) {
            customerName = customerMatch[1].trim()
          } else if (simpleMatch) {
            customerName = simpleMatch[1].trim()
            customerEmail = simpleMatch[2].trim()
          }

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

          const videoExists = customerGroups[customerKey].videos.some((existingVideo: any) => existingVideo.uri === video.uri)
          if (!videoExists) {
            customerGroups[customerKey].videos.push(video)
            customerGroups[customerKey].videoCount = customerGroups[customerKey].videos.length
          }

          if (new Date(video.created_time) < new Date(customerGroups[customerKey].customerSince)) {
            customerGroups[customerKey].customerSince = video.created_time
            customerGroups[customerKey].created_at = video.created_time
          }
        })

        const customerArray = Object.values(customerGroups)
        console.log('✅ Processed customers:', customerArray.length)
        console.log('👥 Customer names:', customerArray.map((c: any) => c.name))
        console.log('📧 Customer emails:', customerArray.map((c: any) => c.email))
        console.log('📊 Sample customer objects:', customerArray.slice(0, 3))

        setCustomers(customerArray)
      } else {
        console.error('❌ API response not OK:', response.status, response.statusText)
        setCustomers([])
      }
    } catch (error) {
      console.error('❌ Error fetching customers:', error)
      setCustomers([])
    }
  }

  const startRecording = async () => {
    try {
      console.log('🎬 Starting screen recording...')

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      setStream(displayStream)

      const recorder = new MediaRecorder(displayStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        setRecordedBlob(blob)
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)

        if (videoRef.current) {
          videoRef.current.src = url
        }

        console.log('✅ Recording completed, blob size:', blob.size)
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      console.log('🔴 Recording started')

    } catch (error) {
      console.error('❌ Error starting recording:', error)
      alert('Failed to start recording. Please ensure you grant screen sharing permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      console.log('⏹️ Recording stopped')
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }

    setIsRecording(false)
  }

  const uploadToVimeo = async () => {
    try {
      setUploading(true)
      setUploadStatus('Uploading...')

      if (!recordedBlob) {
        throw new Error('No recording available')
      }

      // Validate customer selection
      let customerName = ''
      let customerEmail = ''

      if (customerType === 'new') {
        customerName = newCustomerName.trim()
        customerEmail = newCustomerEmail.trim()

        if (!customerName) {
          throw new Error('Please enter a customer name')
        }
        if (!customerEmail) {
          throw new Error('Please enter a customer email')
        }
      } else {
        // Existing customer
        if (!selectedCustomer) {
          throw new Error('Please select an existing customer')
        }

        customerName = selectedCustomer.name || ''
        customerEmail = selectedCustomer.email || ''

        console.log('📋 Selected existing customer:', {
          name: customerName,
          email: customerEmail,
          customerObject: selectedCustomer
        })

        if (!customerName) {
          throw new Error('Selected customer has no name. Please select a different customer.')
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      let liaisonName = 'Unknown User'

      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single()

          liaisonName = profile?.display_name || user.email?.split('@')[0] || 'Unknown User'
        } catch (error) {
          liaisonName = user.email?.split('@')[0] || 'Unknown User'
        }
      }

      console.log('📤 Uploading with metadata:', { customer: customerName, email: customerEmail, liaison: liaisonName })

      const formData = new FormData()
      formData.append('video', recordedBlob, 'recording.webm')
      formData.append('customerName', customerName)
      formData.append('customerEmail', customerEmail)
      formData.append('liaisonName', liaisonName)
      formData.append('description', recordingDescription)

      const response = await fetch('/api/vimeo/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        setUploadStatus('✅ Upload successful!')

        alert(`🎉 VIDEO UPLOADED SUCCESSFULLY!\n\nCustomer: ${customerName}\nLiaison: ${liaisonName}\nFolder: Sparky Screen Recordings`)

        // Reset form
        setRecordedBlob(null)
        setSelectedCustomer(null)
        setNewCustomerName('')
        setNewCustomerEmail('')
        setCustomerType('existing')
        setVideoUrl('')
        if (videoRef.current) {
          videoRef.current.src = ''
        }

        // Refresh customers
        fetchCustomers()

      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      alert(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {currentUser && <GlobalHeader user={currentUser} />}
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <div className="w-full max-w-2xl mx-auto mb-6">
                <div className="aspect-video bg-white rounded-lg border-[5px] border-black flex items-center justify-center relative overflow-hidden shadow-lg">
                  {recordedBlob && !isRecording && (
                    <video
                      ref={videoRef}
                      controls
                      className="w-full h-full object-cover rounded-lg"
                      src={videoUrl}
                    />
                  )}

                  {isRecording && stream && (
                    <video
                      ref={(video) => {
                        if (video && stream) {
                          video.srcObject = stream
                        }
                      }}
                      autoPlay
                      muted
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}

                  {isRecording && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 z-10">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>LIVE</span>
                    </div>
                  )}

                  {!isRecording && !recordedBlob && (
                    <div className="text-center">
                      <img
                        src="/Sparky AI.gif"
                        alt="Sparky AI Logo"
                        className="w-40 h-40 mx-auto mb-4"
                      />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Your recording will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="text-center">
                {!recordedBlob && (
                  <>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                      Recording Controls
                    </h2>

                    <div className="flex justify-center gap-4 mb-4">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          className="px-8 py-4 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 bg-gradient-to-b from-green-400 to-green-700 hover:from-green-500 hover:to-green-800 text-white"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Start Recording</span>
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="bg-gradient-to-b from-red-400 to-red-700 hover:from-red-500 hover:to-red-800 text-white px-8 py-4 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                          <span>Stop Recording</span>
                        </button>
                      )}
                    </div>

                    {isRecording && (
                      <div className="text-red-600 dark:text-red-400 font-medium">
                        🔴 Recording in progress... Recording will stop when you close the screen share
                      </div>
                    )}
                  </>
                )}

                {recordedBlob && !isRecording && (
                  <div className="max-w-xl mx-auto">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                      Customer Information
                    </h3>

                    <div className="mb-6">
                      <div className="flex justify-center gap-6">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="customerType"
                            value="existing"
                            checked={customerType === 'existing'}
                            onChange={(e) => setCustomerType(e.target.value as 'existing' | 'new')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-3"
                          />
                          <span className="text-gray-900 dark:text-white font-medium">
                            Existing Customer
                          </span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="customerType"
                            value="new"
                            checked={customerType === 'new'}
                            onChange={(e) => setCustomerType(e.target.value as 'existing' | 'new')}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 mr-3"
                          />
                          <span className="text-gray-900 dark:text-white font-medium">
                            New Customer
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {customerType === 'existing' ? (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Select Customer
                          </label>
                          <input
                            type="text"
                            placeholder="Search customers..."
                            value={selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.email})` : searchCustomerText}
                            onChange={(e) => {
                              const value = e.target.value
                              setSearchCustomerText(value)
                              setSelectedCustomer(null)

                              if (value.length > 0) {
                                const filtered = customers.filter(customer =>
                                  customer.name?.toLowerCase().includes(value.toLowerCase()) ||
                                  customer.email?.toLowerCase().includes(value.toLowerCase())
                                )
                                setFilteredCustomers(filtered.slice(0, 10))
                                setShowCustomerDropdown(true)
                                console.log('🔍 Filtered customers:', filtered.length, 'for search:', value)
                              } else {
                                setFilteredCustomers([])
                                setShowCustomerDropdown(false)
                              }
                            }}
                            onFocus={() => {
                              console.log('🎯 Search field focused')
                              console.log('📊 Current customers count:', customers.length)
                              console.log('🔤 Current search text:', searchCustomerText)
                              
                              if (customers.length > 0 && !searchCustomerText) {
                                setFilteredCustomers(customers.slice(0, 10))
                                setShowCustomerDropdown(true)
                                console.log('✅ Showing first 10 customers')
                              } else {
                                console.log('⚠️ Not showing dropdown - customers:', customers.length, 'search text:', searchCustomerText)
                              }
                            }}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 top-8">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>

                          {showCustomerDropdown && filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-50 max-h-60 overflow-y-auto">
                              {filteredCustomers.map((customer, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    console.log('👆 Customer selected:', customer)
                                    setSelectedCustomer(customer)
                                    setSearchCustomerText('')
                                    setShowCustomerDropdown(false)
                                    console.log('✅ Selected customer set to:', customer)
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
                                >
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {customer.name}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {customer.email}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {customer.videoCount || 0} videos
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Customer Name *
                            </label>
                            <input
                              type="text"
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                              placeholder="Enter customer name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Customer Email *
                            </label>
                            <input
                              type="email"
                              value={newCustomerEmail}
                              onChange={(e) => setNewCustomerEmail(e.target.value)}
                              placeholder="Enter customer email..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                              required
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description/Comments
                        </label>
                        <textarea
                          value={recordingDescription}
                          onChange={(e) => setRecordingDescription(e.target.value)}
                          placeholder="Add any notes or comments about this recording..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white resize-none"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Optional - will be included in video description
                        </p>
                      </div>
                    </div>

                    {(selectedCustomer || (newCustomerName && newCustomerEmail)) && (
                      <div className="mt-6">
                        <button
                          onClick={uploadToVimeo}
                          disabled={uploading}
                          className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                            uploading
                              ? 'bg-gray-400 cursor-not-allowed text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {uploading ? '⏳ Saving...' : '💾 Save Video'}
                        </button>

                        {uploadStatus && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                            {uploadStatus}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}