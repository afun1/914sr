// filepath: c:\sr97\src\app\page.913.backup.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import GlobalHeader from '@/components/GlobalHeader'
import { supabase } from '@/lib/supabase'
import { ensureUserHasFolder, addVideoToUserFolder } from '@/utils/folderManagement'

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
  const [userVideos, setUserVideos] = useState<any[]>([])
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
    if (currentUser) {
      fetchCustomers()
    }
  }, [currentUser])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const fetchCustomers = async () => {
    if (!currentUser) {
      console.log('⏳ Waiting for user authentication...')
      return
    }

    try {
      console.log('🔄 Loading customers from Vimeo video descriptions...')

      // Use the same API as our working customers page with cache-busting
      const response = await fetch(`/api/vimeo/folders?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
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

        // Filter videos for current user - Use effective user data for proper filtering
        let currentUserName = 'Unknown User'
        let effectiveUserId = currentUser?.id
        let isImpersonating = false

        if (currentUser) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', currentUser.id)
              .single()

            currentUserName = profile?.display_name || currentUser.email?.split('@')[0] || 'Unknown User'

            // Check if we're impersonating (using effective user data)
            const effectiveUserData = localStorage.getItem('effective_user_data')
            if (effectiveUserData) {
              try {
                const effectiveUser = JSON.parse(effectiveUserData)
                console.log('🎭 Raw effective user data:', effectiveUser)
                console.log('🎭 Effective user keys:', Object.keys(effectiveUser))

                // Check for impersonation in different ways
                if (effectiveUser.isImpersonating || effectiveUser.impersonating || effectiveUser.is_impersonating) {
                  console.log('🎭 Detected impersonation - switching to effective user')
                  currentUserName = effectiveUser.display_name || effectiveUser.full_name || effectiveUser.name || effectiveUser.email?.split('@')[0] || 'Unknown User'
                  effectiveUserId = effectiveUser.id || effectiveUser.user_id
                  isImpersonating = true
                  console.log('🎭 Effective user name:', currentUserName, 'ID:', effectiveUserId)
                  console.log('🎭 Effective user email:', effectiveUser.email)
                } else {
                  console.log('🎭 No impersonation flag found, using current user')
                }
              } catch (parseError) {
                console.error('❌ Error parsing effective user data:', parseError)
              }
            } else {
              console.log('🎭 No effective user data in localStorage')
            }
          } catch (error) {
            console.log('❌ Error getting user profile:', error)
            currentUserName = currentUser.email?.split('@')[0] || 'Unknown User'
          }
        }

        console.log('👤 Final filtering user:', currentUserName, 'Impersonating:', isImpersonating)

        // Get videos from folders that belong to current user - same logic as folders page
        const relevantVideos: any[] = []

        if (data.folders && Array.isArray(data.folders)) {
          console.log(`🔍 Processing ${data.folders.length} folders for user: ${currentUserName}`)
          data.folders.forEach((folder: any) => {
            const folderName = (folder.name || '').toLowerCase()
            console.log(`📁 Checking folder: "${folder.name}" (${folder.videos?.length || 0} videos)`)

            // Include folders with "Sparky" and "Screen" and "Recording" in the name (main repo)
            const isSparkyFolder = folderName.includes('sparky') &&
                                  folderName.includes('screen') &&
                                  folderName.includes('recording')

            // Also include Team Library folders (like folders page does)
            const isTeamLibrary = /team.*library/i.test(folder.name || '') ||
                                 /sparky.*screen.*recording/i.test(folder.name || '')

            // Include specific nested folders for current user (liaison folders)
            const isUserFolder = folderName.includes(currentUserName.toLowerCase()) ||
                                (currentUserName.toLowerCase() === 'jeanet hazar' && folderName.includes('john bradshaw')) ||
                                (currentUserName.toLowerCase() === 'john bradshaw' && folderName.includes('bradshaw')) ||
                                folderName.includes('john') ||
                                // Also include folders that match the effective user's name variations
                                folderName.includes(currentUserName.toLowerCase().replace(' ', '')) ||
                                folderName.includes(currentUserName.toLowerCase().split(' ')[0])

            console.log(`📁 Folder "${folder.name}": isSparky=${isSparkyFolder}, isTeamLibrary=${isTeamLibrary}, isUserFolder=${isUserFolder}`)

            if (isSparkyFolder || isTeamLibrary || isUserFolder) {
              console.log(`📁 ✅ Including folder for user videos: "${folder.name}" with ${folder.videos?.length || 0} videos`)
              if (folder.videos && Array.isArray(folder.videos)) {
                folder.videos.forEach((video: any) => {
                  if (video.uri && !relevantVideos.find(v => v.uri === video.uri)) {
                    relevantVideos.push(video)
                  }
                })
              }
            } else {
              console.log(`📁 ❌ Skipping folder: "${folder.name}"`)
            }
          })
        }

        console.log(`🎥 Total relevant videos found: ${relevantVideos.length}`)

        // Now filter these relevant videos by who recorded them using effective user
        const currentUserVideos = relevantVideos.filter((video: any) => {
          const description = video.description || ''
          // Check if video was recorded by current effective user - try different patterns
          const recordedByMatch = description.match(/Recorded by:\s*([^\n\r]+?)(?:\s+Timestamp:|$)/)
          const liaisonMatch = description.match(/Liaison:\s*([^\n\r]+?)(?:\s+Recorded:|$)/)

          if (recordedByMatch) {
            const recordedBy = recordedByMatch[1].trim()
            // Check if this video belongs to the effective user - STRICT filtering
            const isCurrentUserVideo = recordedBy === currentUserName ||
                                     recordedBy.toLowerCase() === currentUserName.toLowerCase() ||
                                     (currentUserName === 'Jeanet Hazar' && recordedBy === 'jeanet') ||
                                     (currentUserName === 'Jeanet Hazar' && recordedBy === 'Jeanet') ||
                                     (currentUserName === 'Jeanet Hazar' && recordedBy.toLowerCase().includes('jeanet'))
            return isCurrentUserVideo
          } else if (liaisonMatch) {
            const liaison = liaisonMatch[1].trim()
            // Check if this video belongs to the effective user - STRICT filtering
            const isCurrentUserVideo = liaison === currentUserName ||
                                     liaison.toLowerCase() === currentUserName.toLowerCase() ||
                                     (currentUserName === 'Jeanet Hazar' && liaison === 'jeanet') ||
                                     (currentUserName === 'Jeanet Hazar' && liaison === 'Jeanet') ||
                                     (currentUserName === 'Jeanet Hazar' && liaison.toLowerCase().includes('jeanet'))
            return isCurrentUserVideo
          } else {
            // If no explicit user field, check if video is in a folder that belongs to this user
            const videoFolder = data.folders?.find((f: any) =>
              f.videos?.some((v: any) => v.uri === video.uri)
            )
            if (videoFolder) {
              const folderName = (videoFolder.name || '').toLowerCase()
              // STRICT folder filtering - only include folders that exactly match the user
              const isUserFolder = folderName === currentUserName.toLowerCase() ||
                                 folderName === `jeanet hazar` ||
                                 (currentUserName === 'Jeanet Hazar' && folderName.includes('jeanet'))
              return isUserFolder
            }
            return false
          }
        })

        // Apply Jeanet-specific filtering to ensure she only sees her videos
        let filteredVideos = currentUserVideos
        if (currentUserName === 'Jeanet Hazar') {
          filteredVideos = currentUserVideos.filter((video: any) => {
            const description = video.description || ''
            const hasJeanetReference = description.toLowerCase().includes('jeanet') ||
                                     description.toLowerCase().includes('jeanethazar') ||
                                     description.includes('Jeanet Hazar')

            // Check if video is in Jeanet's specific folder
            const videoFolder = data.folders?.find((f: any) =>
              f.videos?.some((v: any) => v.uri === video.uri)
            )
            const isInJeanetFolder = videoFolder &&
                                   (videoFolder.name || '').toLowerCase().includes('jeanet')

            return hasJeanetReference || isInJeanetFolder
          })
        }

        setUserVideos(filteredVideos)

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

        console.log('✅ Processed customers:', customerArray.length)
        console.log('👥 Customer names:', customerArray.map((c: any) => c.name))

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
      setUploadStatus('')

      if (!recordedBlob) {
        throw new Error('No recording available')
      }

      const customerName = customerType === 'new' ? newCustomerName : (selectedCustomer?.name || '')
      const customerEmail = customerType === 'new' ? newCustomerEmail : (selectedCustomer?.email || '')

      // Get liaison name from current user's profile
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
          console.log('👤 Liaison name resolved:', liaisonName, 'from profile:', profile?.display_name)
        } catch (error) {
          console.log('Could not get user profile, using email:', error)
          liaisonName = user.email?.split('@')[0] || 'Unknown User'
        }
      }

      console.log('📤 Uploading with metadata:', { customer: customerName, email: customerEmail, liaison: liaisonName, timestamp: new Date().toLocaleString() })

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
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        setUploadStatus('Upload successful!')

        // 🎯 AUTOMATIC FOLDER MANAGEMENT - Create folder and place video
        try {
          console.log('📁 Starting automatic folder management...')

          // Get the effective user for folder creation
          let effectiveUser = user
          const effectiveUserData = localStorage.getItem('effective_user_data')
          if (effectiveUserData) {
            const parsed = JSON.parse(effectiveUserData)
            if (parsed.isImpersonating) {
              effectiveUser = { ...user, ...parsed }
              console.log('🎭 Using effective user for folder creation:', parsed.display_name)
            }
          }

          // Ensure we have a valid user object
          if (!effectiveUser || !effectiveUser.id || !effectiveUser.email) {
            console.error('❌ No valid user found for folder creation')
            throw new Error('Invalid user data')
          }

          // Ensure user has a folder
          const userFolder = await ensureUserHasFolder({
            id: effectiveUser.id,
            email: effectiveUser.email,
            full_name: (effectiveUser as any).display_name || liaisonName,
            display_name: (effectiveUser as any).display_name || liaisonName
          })

          if (userFolder) {
            console.log(`✅ User folder ready: ${userFolder.name}`)

            // Place the video in the user's folder
            const videoData = {
              uri: result.videoUri || result.uri,
              name: `Recording for ${customerName}`,
              description: `Customer: ${customerName}\nEmail: ${customerEmail}\nLiaison: ${liaisonName}\nRecorded: ${new Date().toLocaleString()}`
            }

            const placed = await addVideoToUserFolder(videoData, {
              id: effectiveUser.id,
              email: effectiveUser.email,
              full_name: (effectiveUser as any).display_name || liaisonName,
              display_name: (effectiveUser as any).display_name || liaisonName
            })

            if (placed) {
              console.log('✅ Video placed in user folder')
            } else {
              console.log('⚠️ Video uploaded but folder placement failed')
            }
          } else {
            console.log('⚠️ Could not create/ensure user folder')
          }
        } catch (folderError) {
          console.error('❌ Error in automatic folder management:', folderError)
          // Don't fail the upload if folder management fails
        }

        // Enhanced success message based on folder organization
        if (result.wasNewFolder) {
          alert(`🎉 VIDEO UPLOADED + SPARKY FOLDER CREATED!

Customer: ${customerName}
Liaison: ${liaisonName}
Folder: ${result.folder}

✨ This is your FIRST screen recording!
All your videos are organized in the main
Sparky Screen Recordings folder.

📂 Check /admin/folders to see your videos organized by user!`)
        } else {
          alert(`✅ Video uploaded successfully!

Customer: ${customerName}
Liaison: ${liaisonName}
Folder: ${result.folder}

📁 Added to Sparky Screen Recordings folder.
All your videos are organized together!

📂 View them at /admin/folders organized by user!`)
        }

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

        // Refresh customers and user videos after successful upload
        fetchCustomers()

      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
              {/* Centered Preview Window */}
              <div className="w-full max-w-2xl mx-auto mb-6">
                <div className="aspect-video bg-white rounded-lg border-[5px] border-black flex items-center justify-center relative overflow-hidden shadow-lg">
                  {/* Recording Preview - Completed Recording */}
                  {recordedBlob && !isRecording && (
                    <video
                      ref={videoRef}
                      controls
                      className="w-full h-full object-cover rounded-lg"
                      src={videoUrl}
                    />
                  )}

                  {/* Live Recording Preview */}
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

                  {/* Recording Indicator Overlay */}
                  {isRecording && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 z-10">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>LIVE</span>
                    </div>
                  )}

                  {/* Default State - Sparky */}
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

            {/* Recording Controls / Customer Selection */}
            <div className="mb-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="text-center">
                {/* Show recording controls when no recording or currently recording */}
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

                {/* Customer Form - appears after recording stops */}
                {recordedBlob && !isRecording && (
                  <div className="max-w-xl mx-auto">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                      Customer Information
                    </h3>

                    {/* Customer Type Radio Buttons */}
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

                    {/* Customer Form Fields */}
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

                              // Filter customers based on search
                              if (value.length > 0) {
                                const filtered = customers.filter(customer =>
                                  customer.name?.toLowerCase().includes(value.toLowerCase()) ||
                                  customer.email?.toLowerCase().includes(value.toLowerCase())
                                )
                                setFilteredCustomers(filtered.slice(0, 10))
                                setShowCustomerDropdown(true)
                              } else {
                                setFilteredCustomers([])
                                setShowCustomerDropdown(false)
                              }
                            }}
                            onFocus={() => {
                              if (customers.length > 0 && !searchCustomerText) {
                                setFilteredCustomers(customers.slice(0, 10))
                                setShowCustomerDropdown(true)
                              }
                            }}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 top-8">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>

                          {/* Customer Dropdown */}
                          {showCustomerDropdown && filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-50 max-h-60 overflow-y-auto">
                              {filteredCustomers.map((customer, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    setSelectedCustomer(customer)
                                    setSearchCustomerText('')
                                    setShowCustomerDropdown(false)
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

                    {/* Upload Button */}
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
                          {uploading ? '⏳ Saving...' : '� Save'}
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

            {/* Your Recordings Panel */}
            <div className="mb-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Your Recordings
                </h2>
              </div>

              {userVideos.length === 0 ? (
                <div className="text-center">
                  <div className="text-6xl mb-4">🎬</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No recordings yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your recordings will appear here after you upload them
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userVideos.map((video: any, index: number) => {
                    // Extract customer name from description
                    let customerName = 'Unknown Customer'
                    const description = video.description || ''
                    const customerMatch = description.match(/Customer:\s*([^\n\r]+?)(?:\s+Email:|$)/i)
                    const simpleMatch = description.match(/Screen recording for\s+(.+?)\s*\(([^)]+)\)/i)

                    if (customerMatch) {
                      customerName = customerMatch[1].trim()
                    } else if (simpleMatch) {
                      customerName = simpleMatch[1].trim()
                    }

                    return (
                      <div key={video.uri || index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                        {/* Video Thumbnail */}
                        <div className="aspect-video bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          {video.pictures?.sizes?.[0]?.link ? (
                            <img
                              src={video.pictures.sizes[0].link}
                              alt={`Recording for ${customerName}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-gray-400">
                              🎥 No thumbnail
                            </div>
                          )}
                        </div>

                        {/* Video Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">
                            {customerName}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {new Date(video.created_time).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>⏱️ {Math.round(video.duration / 60)} min</span>
                            <span>👀 {video.stats?.plays || 0} views</span>
                          </div>

                          {/* View Video Button */}
                          <a
                            href={video.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 w-full inline-block text-center px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            🎬 View Video
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>


          </div>
        </div>
      </div>
    </>
  )
}