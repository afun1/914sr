'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useVimeo } from '@/hooks/useVimeo'
import { useNotifications } from './NotificationSystem'
import { useUser } from './AuthWrapper'
import type { UserRole } from '@/types/supabase'

interface SmoothScreenRecorderProps {
  userRole?: UserRole
}

export default function SmoothScreenRecorder({ userRole = 'user' }: SmoothScreenRecorderProps) {
  const { addNotification } = useNotifications()
  const { uploadVideoForUser, loading: vimeoLoading, videos, fetchVideos } = useVimeo()
  const { user, profile } = useUser()
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  
  // Customer form state
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('new')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [recordingDescription, setRecordingDescription] = useState('')
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState('')
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [duplicateCustomer, setDuplicateCustomer] = useState<any>(null)
  
  // Recording settings
  const [includeAudio, setIncludeAudio] = useState(true)
  const [audioSource, setAudioSource] = useState<'system' | 'microphone' | 'both'>('system')
  const [quality, setQuality] = useState<'1080p' | '720p' | '480p'>('480p')
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Quality settings
  const qualitySettings = {
    '1080p': { width: 1920, height: 1080, bitrate: 8000000 },
    '720p': { width: 1280, height: 720, bitrate: 5000000 },
    '480p': { width: 854, height: 480, bitrate: 2500000 }
  }

  // Canvas drawing function for smooth preview
  const drawToCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    
    if (canvas && video && video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Set canvas size to match video dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 1280
          canvas.height = video.videoHeight || 720
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Draw video frame to canvas
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        } catch (err) {
          console.warn('Error drawing video to canvas:', err)
        }
        
        // Add recording indicator overlay
        if (isRecording && !isPaused) {
          // Recording dot
          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.arc(30, 30, 10, 0, 2 * Math.PI)
          ctx.fill()
          
          // REC text
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 16px Arial'
          ctx.shadowColor = '#000000'
          ctx.shadowBlur = 2
          ctx.fillText('REC', 50, 35)
          
          // Timer
          const minutes = Math.floor(recordingDuration / 60)
          const seconds = recordingDuration % 60
          const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          ctx.fillText(timeString, 100, 35)
          ctx.shadowBlur = 0
        }
      }
    }
    
    // Continue animation loop while video has a source (not just while recording)
    if (videoRef.current && videoRef.current.srcObject) {
      animationFrameRef.current = requestAnimationFrame(drawToCanvas)
    }
  }, [isRecording, isPaused, recordingDuration])

  const loadExistingCustomers = useCallback(async () => {
    try {
      console.log('📊 Loading customers from Vimeo videos...')
      
      // First, ensure we have fresh video data
      if (videos.length === 0) {
        console.log('🔄 No videos in state, fetching from Vimeo...')
        await fetchVideos()
      }
      
      console.log(`📋 Processing ${videos.length} videos for customer data`)
      
      // Extract customer information from video descriptions
      const customerMap = new Map()
      
      videos.forEach((video: any) => {
        const description = video.description || ''
        const customerInfo = parseCustomerInfoFromDescription(description)
        
        if (customerInfo.customerName && customerInfo.customerEmail) {
          const customerId = customerInfo.customerEmail.toLowerCase()
          
          // Use Map to automatically deduplicate by email
          if (!customerMap.has(customerId)) {
            customerMap.set(customerId, {
              id: customerId,
              name: customerInfo.customerName,
              email: customerInfo.customerEmail,
              createdAt: video.created_time || new Date().toISOString()
            })
          }
        }
      })
      
      const customersFromVimeo = Array.from(customerMap.values())
      console.log(`✅ Extracted ${customersFromVimeo.length} unique customers from Vimeo:`, customersFromVimeo)
      
      // Also check localStorage for any additional customers
      const storedCustomers = localStorage.getItem('customers')
      let allCustomers = [...customersFromVimeo]
      
      if (storedCustomers) {
        const localCustomers = JSON.parse(storedCustomers)
        console.log(`📋 Found ${localCustomers.length} additional customers in localStorage`)
        
        // Merge with Vimeo customers, avoiding duplicates
        localCustomers.forEach((localCustomer: any) => {
          if (!customerMap.has(localCustomer.email?.toLowerCase())) {
            allCustomers.push(localCustomer)
          }
        })
      }
      
      // Sort by name for better UX
      allCustomers.sort((a, b) => a.name.localeCompare(b.name))
      
      setExistingCustomers(allCustomers)
      console.log(`✅ Total customers available: ${allCustomers.length}`)
      
    } catch (error) {
      console.error('❌ Error loading customers from Vimeo:', error)
      
      // Fallback to localStorage only
      const storedCustomers = localStorage.getItem('customers')
      if (storedCustomers) {
        const customers = JSON.parse(storedCustomers)
        setExistingCustomers(deduplicateCustomersByEmail(customers))
        console.log('📋 Fallback: loaded customers from localStorage only')
      } else {
        setExistingCustomers([])
        console.log('❌ No customers available from any source')
      }
    }
  }, [videos, fetchVideos])
  
  // Load existing customers when form opens or videos change
  useEffect(() => {
    if (showCustomerForm) {
      loadExistingCustomers()
    }
  }, [showCustomerForm, loadExistingCustomers])
  
  // Helper function to parse customer info from Vimeo description
  const parseCustomerInfoFromDescription = (description: string) => {
    const customerNameMatch = description.match(/Customer:\s*(.+?)(?:\n|$)/i)
    const customerEmailMatch = description.match(/Email:\s*(.+?)(?:\n|$)/i)
    
    return {
      customerName: customerNameMatch?.[1]?.trim(),
      customerEmail: customerEmailMatch?.[1]?.trim()
    }
  }

  const deduplicateCustomersByEmail = (customers: any[]) => {
    const emailMap = new Map()
    
    // Process customers in reverse order (newest first) so newer entries overwrite older ones
    customers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    customers.forEach(customer => {
      const email = customer.email.toLowerCase()
      if (!emailMap.has(email)) {
        // Create a clean customer with guaranteed unique ID
        const cleanCustomer = {
          ...customer,
          id: `customer_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        emailMap.set(email, cleanCustomer)
      }
    })
    
    return Array.from(emailMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  const checkForDuplicateCustomer = (email: string) => {
    return existingCustomers.find(customer => 
      customer.email.toLowerCase() === email.toLowerCase()
    )
  }

  const saveCustomer = async (customerData: any) => {
    try {
      const existingCustomers = JSON.parse(localStorage.getItem('customers') || '[]')
      
      // Check if customer with this email already exists
      const existingCustomerIndex = existingCustomers.findIndex(
        (customer: any) => customer.email.toLowerCase() === customerData.email.toLowerCase()
      )
      
      if (existingCustomerIndex !== -1) {
        // Update existing customer with new information
        const existingCustomer = existingCustomers[existingCustomerIndex]
        const updatedCustomer = {
          ...existingCustomer,
          ...customerData,
          // Keep original creation info
          id: existingCustomer.id,
          created_at: existingCustomer.created_at,
          created_by: existingCustomer.created_by,
          // Update modification info
          updated_at: new Date().toISOString(),
          updated_by: user?.id || 'unknown'
        }
        
        existingCustomers[existingCustomerIndex] = updatedCustomer
        localStorage.setItem('customers', JSON.stringify(existingCustomers))
        
        return updatedCustomer
      } else {
        // Create new customer
        const newCustomer = {
          id: Date.now().toString(),
          ...customerData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: user?.id || 'unknown'
        }
        
        const updatedCustomers = [...existingCustomers, newCustomer]
        localStorage.setItem('customers', JSON.stringify(updatedCustomers))
        
        return newCustomer
      }
    } catch (error) {
      console.error('Error saving customer:', error)
      throw error
    }
  }

  // Setup video stream for direct display
  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      video.srcObject = stream
      video.muted = true
      video.autoplay = true
      video.playsInline = true
      
      const handleVideoReady = () => {
        console.log('Video ready for direct display:', {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState
        })
        // Start canvas drawing for preview
        drawToCanvas()
      }

      const handleCanPlay = () => {
        console.log('Video can play - starting canvas drawing')
        drawToCanvas()
      }

      const handleLoadedData = () => {
        console.log('Video data loaded, dimensions:', video.videoWidth, 'x', video.videoHeight)
        drawToCanvas()
      }

      const handlePlay = () => {
        console.log('Video started playing')
        drawToCanvas()
      }

      // Add all event listeners
      video.addEventListener('loadeddata', handleLoadedData)
      video.addEventListener('canplay', handleCanPlay)
      video.addEventListener('play', handlePlay)
      
      // Start playing the video
      video.play().catch(err => console.log('Video play error (preview):', err))
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData)
        video.removeEventListener('canplay', handleCanPlay)
        video.removeEventListener('play', handlePlay)
      }
    }
  }, [stream, drawToCanvas])

  // Start screen capture
  const startCapture = useCallback(async () => {
    try {
      const settings = qualitySettings[quality]
      
      // Enhanced display media constraints for smoother capture
      const displayMediaOptions = {
        video: {
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: 30, max: 60 }, // Higher frame rate for smoother capture
          cursor: 'always' as const,
          displaySurface: 'browser' as const
        },
        audio: includeAudio && (audioSource === 'system' || audioSource === 'both')
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
      
      // Get microphone audio if needed
      let microphoneStream: MediaStream | null = null
      if (includeAudio && (audioSource === 'microphone' || audioSource === 'both')) {
        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          })
        } catch (err) {
          console.warn('Could not access microphone:', err)
          addNotification({
            type: 'warning',
            title: 'Microphone Access',
            message: 'Could not access microphone, recording without mic audio'
          })
        }
      }

      // Combine streams if needed
      let finalStream = displayStream
      if (microphoneStream && audioSource === 'both') {
        const audioContext = new AudioContext()
        const destination = audioContext.createMediaStreamDestination()
        
        const displaySource = audioContext.createMediaStreamSource(displayStream)
        const micSource = audioContext.createMediaStreamSource(microphoneStream)
        
        displaySource.connect(destination)
        micSource.connect(destination)
        
        // Combine video from display with mixed audio
        const videoTrack = displayStream.getVideoTracks()[0]
        const audioTrack = destination.stream.getAudioTracks()[0]
        
        finalStream = new MediaStream([videoTrack, audioTrack])
      } else if (microphoneStream && audioSource === 'microphone') {
        // Use display video with microphone audio
        const videoTrack = displayStream.getVideoTracks()[0]
        const audioTrack = microphoneStream.getAudioTracks()[0]
        finalStream = new MediaStream([videoTrack, audioTrack])
      }

      setStream(finalStream)

      // Set up MediaRecorder with better settings
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: settings.bitrate,
        audioBitsPerSecond: 128000
      }

      return finalStream
    } catch (err) {
      console.error('Error starting capture:', err)
      addNotification({
        type: 'error',
        title: 'Screen Capture Failed',
        message: 'Could not start screen recording. Please try again.'
      })
      throw err
    }
  }, [quality, includeAudio, audioSource, addNotification])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      let captureStream = stream
      
      // Only request new capture if we don't have an existing stream
      if (!captureStream) {
        const newStream = await startCapture()
        // Type guard to ensure we got a MediaStream
        if (newStream && typeof newStream === 'object' && 'getTracks' in newStream) {
          captureStream = newStream as MediaStream
        }
      }
      
      // Type guard to ensure captureStream is MediaStream
      if (captureStream && typeof captureStream === 'object' && 'getTracks' in captureStream) {
        // Set up MediaRecorder with codec fallbacks
        const options = {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: qualitySettings[quality].bitrate,
          audioBitsPerSecond: 128000
        }

        // Fallback to vp8 if vp9 not supported
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm;codecs=vp8,opus'
        }

        // Further fallback
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm'
        }
        
        mediaRecorderRef.current = new MediaRecorder(captureStream as MediaStream, options)
        chunksRef.current = []
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }
        
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' })
          setRecordedBlob(blob)
          chunksRef.current = []
        }
        
        setIsRecording(true)
        setRecordingDuration(0)
        
        // Start the MediaRecorder
        mediaRecorderRef.current.start(100) // Capture data every 100ms for smoother recording
        
        // Start timer
        intervalRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1)
        }, 1000)

        addNotification({
          type: 'success',
          title: 'Recording Started',
          message: 'Screen recording has begun'
        })
      }
    } catch (err) {
      console.error('Failed to start recording:', err)
      addNotification({
        type: 'error',
        title: 'Recording Failed',
        message: 'Could not start recording. Please try again.'
      })
    }
  }, [stream, startCapture, addNotification, quality])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      
      // Stop all tracks
      stream?.getTracks().forEach(track => track.stop())
      setStream(null)
      
      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      addNotification({
        type: 'success',
        title: 'Recording Stopped',
        message: 'Screen recording completed successfully'
      })
      
      // Show customer form
      setShowCustomerForm(true)
    }
  }, [isRecording, stream, addNotification])

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        if (intervalRef.current) {
          intervalRef.current = setInterval(() => {
            setRecordingDuration(prev => prev + 1)
          }, 1000)
        }
      } else {
        mediaRecorderRef.current.pause()
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
      setIsPaused(!isPaused)
    }
  }, [isRecording, isPaused])

  // Upload recording
  const uploadRecording = useCallback(async () => {
    // Validate form based on customer type
    if (customerType === 'existing' && !selectedExistingCustomer) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please select an existing customer'
      })
      return
    }

    if (customerType === 'new' && (!customerName.trim() || !customerEmail.trim())) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please provide customer name and email'
      })
      return
    }

    if (!recordedBlob) {
      addNotification({
        type: 'error',
        title: 'No Recording',
        message: 'No recording found to upload'
      })
      return
    }

    // Handle new customer - check for duplicates
    if (customerType === 'new') {
      const duplicate = checkForDuplicateCustomer(customerEmail)
      if (duplicate) {
        setDuplicateCustomer(duplicate)
        setShowDuplicateDialog(true)
        return
      }
    }

    await processUpload()
  }, [customerType, selectedExistingCustomer, customerName, customerEmail, recordedBlob, existingCustomers])

  const processUpload = async () => {
    if (!recordedBlob) {
      addNotification({
        type: 'error',
        title: 'No Recording',
        message: 'No recording found to upload'
      })
      return
    }

    try {
      let finalCustomerName = customerName
      let finalCustomerEmail = customerEmail

      // Handle customer selection/creation
      if (customerType === 'existing') {
        const customer = existingCustomers.find(c => c.id === selectedExistingCustomer)
        if (customer) {
          finalCustomerName = customer.name
          finalCustomerEmail = customer.email
        }
      } else {
        // Save new customer
        await saveCustomer({
          name: customerName,
          email: customerEmail,
          notes: recordingDescription
        })
      }

      const file = new File([recordedBlob], `${finalCustomerName}-recording.webm`, {
        type: 'video/webm',
        lastModified: Date.now()
      })

      const videoTitle = `${finalCustomerName} - Screen Recording (${new Date().toLocaleString()})`
      const videoDescription = recordingDescription.trim() 
        ? `Screen recording session for ${finalCustomerName}.\n\nAdditional notes: ${recordingDescription}`
        : `Screen recording session for ${finalCustomerName}.`

      // Create a name mapping for liaison identification
      const getDisplayName = () => {
        if (profile?.display_name) return profile.display_name
        if (user?.user_metadata?.full_name) return user.user_metadata.full_name
        
        // Email-based name mapping for specific users
        const emailToNameMap: { [key: string]: string } = {
          'john@tpnlife.com': 'John Bradshaw',
          'john+test@tpnlife.com': 'John Bradshaw',
          'john+admin@tpnlife.com': 'John Bradshaw',
          'john+1@tpnlife.com': 'John User',
          'john+2@tpnlife.com': 'John Manager',
          'john+3@tpnlife.com': 'John Supervisor',
          'john+s2@tpnlife.com': 'John S2',
          'john+s3@tpnlife.com': 'John S3',
          'john+user@tpnlife.com': 'John User',
          'john+manager@tpnlife.com': 'John Manager',
          // Add other users here as needed
        }
        
        if (user?.email) {
          // Check exact email match first
          if (emailToNameMap[user.email]) {
            return emailToNameMap[user.email]
          }
          
          // For unmapped john+ emails, create a name from the email prefix
          if (user.email.startsWith('john+') && user.email.includes('@tpnlife.com')) {
            const prefix = user.email.split('@')[0].replace('john+', '')
            return `John ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`
          }
        }
        
        // Fallback to email username
        return user?.email?.split('@')[0] || 'Unknown User'
      }

      const vimeoUri = await uploadVideoForUser(
        file, 
        finalCustomerName,
        finalCustomerEmail,
        getDisplayName(),
        videoTitle,
        videoDescription
      )
      
      if (vimeoUri) {
        addNotification({
          type: 'success',
          title: 'Upload Successful!',
          message: `Recording uploaded to Vimeo for ${finalCustomerName}`
        })
        
        // Reset form
        setShowCustomerForm(false)
        setCustomerType('new')
        setCustomerName('')
        setCustomerEmail('')
        setSelectedExistingCustomer('')
        setRecordingDescription('')
        setRecordedBlob(null)
        setRecordingDuration(0)
        setShowDuplicateDialog(false)
        setDuplicateCustomer(null)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload recording. Please try again.'
      })
    }
  }

  const handleDuplicateChoice = async (useExisting: boolean) => {
    if (useExisting && duplicateCustomer) {
      setCustomerName(duplicateCustomer.name)
      setCustomerEmail(duplicateCustomer.email)
      setShowDuplicateDialog(false)
      await processUpload()
    } else {
      setCustomerEmail('')
      setShowDuplicateDialog(false)
      setDuplicateCustomer(null)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [stream])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Recording Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 relative border-2 border-dashed border-gray-300 dark:border-gray-600">
          {/* Direct video preview */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            style={{ display: stream ? 'block' : 'none' }}
            onLoadedData={() => {
              console.log('Video data loaded, dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight)
            }}
            onPlay={() => {
              console.log('Video started playing')
            }}
            onError={(e) => {
              console.error('Video error:', e)
            }}
          />
          
          {/* Canvas for additional effects (if needed later) */}
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          
          {/* Empty state placeholder */}
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-12 h-12 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-400 dark:text-gray-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>System ready</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Recording overlay */}
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">REC</span>
              <span className="text-sm">
                {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:
                {(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
          
          {/* Paused overlay */}
          {isPaused && (
            <div className="absolute top-4 right-4 bg-yellow-600 text-white px-3 py-1 rounded-full">
              <span className="text-sm font-medium">PAUSED</span>
            </div>
          )}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex flex-wrap gap-4 items-center justify-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={vimeoLoading}
              className="bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
              <span>Start Recording</span>
            </button>
          ) : (
            <>
              <button
                onClick={togglePause}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {isPaused ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                    <span>Pause</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Recording Settings */}
        {!isRecording && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quality Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Video Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="1080p">1080p (High Quality)</option>
                <option value="720p">720p (Good Quality)</option>
                <option value="480p">480p (Fast Upload)</option>
              </select>
            </div>

            {/* Audio Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Audio Source
              </label>
              <select
                value={audioSource}
                onChange={(e) => setAudioSource(e.target.value as any)}
                disabled={!includeAudio}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="system">System Audio</option>
                <option value="microphone">Microphone</option>
                <option value="both">System + Microphone</option>
              </select>
            </div>

            {/* Include Audio Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeAudio"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeAudio" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Include Audio
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      {showCustomerForm && recordedBlob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recording Complete - Customer Information
            </h3>
            
            <div className="space-y-4">
              {/* Customer Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="new"
                      checked={customerType === 'new'}
                      onChange={(e) => setCustomerType(e.target.value as 'new' | 'existing')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">New Customer</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="existing"
                      checked={customerType === 'existing'}
                      onChange={(e) => setCustomerType(e.target.value as 'new' | 'existing')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Existing Customer</span>
                  </label>
                </div>
              </div>

              {/* Existing Customer Selection */}
              {customerType === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Customer *
                  </label>
                  <select
                    value={selectedExistingCustomer}
                    onChange={(e) => setSelectedExistingCustomer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Choose a customer...</option>
                    {existingCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email})
                      </option>
                    ))}
                  </select>
                  {existingCustomers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      No existing customers found. Please select "New Customer".
                    </p>
                  )}
                </div>
              )}

              {/* New Customer Fields */}
              {customerType === 'new' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter customer name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Customer Email *
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter customer email"
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={recordingDescription}
                  onChange={(e) => setRecordingDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Any additional notes about this recording..."
                />
              </div>
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button
                onClick={uploadRecording}
                disabled={vimeoLoading || 
                  (customerType === 'new' && (!customerName.trim() || !customerEmail.trim())) ||
                  (customerType === 'existing' && !selectedExistingCustomer)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                {vimeoLoading ? 'Uploading...' : 'Upload Recording'}
              </button>
              <button
                onClick={() => setShowCustomerForm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Customer Dialog */}
      {showDuplicateDialog && duplicateCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Customer Email Already Exists
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                A customer with email <strong>{duplicateCustomer.email}</strong> already exists:
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                <p className="font-medium text-gray-900 dark:text-white">{duplicateCustomer.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{duplicateCustomer.email}</p>
                {duplicateCustomer.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{duplicateCustomer.notes}</p>
                )}
              </div>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Would you like to save this recording to the existing customer, or enter a different email address?
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleDuplicateChoice(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                Use Existing Customer
              </button>
              <button
                onClick={() => handleDuplicateChoice(false)}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md font-medium transition-colors"
              >
                Enter Different Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
