'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNotifications } from './NotificationSystem'
import RecordingHistoryAdvanced, { type RecordingHistoryRef } from './RecordingHistoryAdvanced'
import { useVimeo } from '@/hooks/useVimeo'
import { useUser } from './AuthWrapper'
import UserVideos from './UserVideos'
import type { UserRole } from '@/types/supabase'

interface AdvancedScreenRecorderProps {
  userRole?: UserRole
}

export default function AdvancedScreenRecorder({ userRole = 'user' }: AdvancedScreenRecorderProps) {
  const { addNotification } = useNotifications()
  const { uploadVideoForUser, loading: vimeoLoading } = useVimeo()
  const { user, profile } = useUser()
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [includeAudio, setIncludeAudio] = useState(true)
  const [audioSource, setAudioSource] = useState<'none' | 'system' | 'microphone' | 'both'>('system')
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('low')
  const [showHistory, setShowHistory] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  
  // Customer form state
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [recordingDescription, setRecordingDescription] = useState('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const historyRef = useRef<RecordingHistoryRef>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
        return
      }

      // Space bar to start/stop recording
      if (event.code === 'Space') {
        event.preventDefault()
        if (isRecording) {
          if (isPaused) {
            resumeRecording()
          } else {
            pauseRecording()
          }
        } else if (!recordedBlob) {
          startRecording()
        }
      }
      
      // Escape key to stop recording
      if (event.code === 'Escape' && isRecording) {
        stopRecording()
      }
      
      // Ctrl/Cmd + D to download recording
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyD' && recordedBlob) {
        event.preventDefault()
        downloadRecording()
      }
      
      // Ctrl/Cmd + R to record again
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyR' && recordedBlob) {
        event.preventDefault()
        clearRecording()
        setTimeout(startRecording, 100)
      }

      // I key to toggle instructions
      if (event.code === 'KeyI' && !isRecording) {
        setShowInstructions(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isRecording, recordedBlob, isPaused])

  const getQualitySettings = () => {
    switch (quality) {
      case 'high':
        return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
      case 'medium':
        return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } }
      case 'low':
        return { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
    }
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      stream?.getTracks().forEach(track => track.stop())
      setStream(null)
      setIsPaused(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording, stream])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      addNotification({
        type: 'info',
        title: 'Recording Paused',
        message: 'Press SPACE to resume recording.',
        duration: 3000
      })
    }
  }, [isRecording, isPaused, addNotification])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
      addNotification({
        type: 'info',
        title: 'Recording Resumed',
        message: 'Recording is now active.',
        duration: 2000
      })
    }
  }, [isRecording, isPaused, addNotification])

  const startRecording = useCallback(async () => {
    try {
      const qualitySettings = getQualitySettings()
      
      // Get display media (screen capture)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: qualitySettings,
        audio: audioSource === 'system' || audioSource === 'both'
      })

      let finalStream = displayStream

      // If we need microphone audio, get it separately and combine
      if (audioSource === 'microphone' || audioSource === 'both') {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
          })

          if (audioSource === 'both') {
            // Combine system audio and microphone
            const audioContext = new AudioContext()
            const destination = audioContext.createMediaStreamDestination()
            
            // Add display audio tracks
            displayStream.getAudioTracks().forEach(track => {
              const source = audioContext.createMediaStreamSource(new MediaStream([track]))
              source.connect(destination)
            })
            
            // Add microphone audio tracks
            micStream.getAudioTracks().forEach(track => {
              const source = audioContext.createMediaStreamSource(new MediaStream([track]))
              source.connect(destination)
            })

            // Create new stream with video from display and combined audio
            const videoTrack = displayStream.getVideoTracks()[0]
            const combinedAudioTrack = destination.stream.getAudioTracks()[0]
            finalStream = new MediaStream([videoTrack, combinedAudioTrack])
          } else if (audioSource === 'microphone') {
            // Use only microphone audio
            const videoTrack = displayStream.getVideoTracks()[0]
            const micAudioTrack = micStream.getAudioTracks()[0]
            finalStream = new MediaStream([videoTrack, micAudioTrack])
          }
        } catch (micError) {
          console.warn('Microphone access denied:', micError)
          addNotification({
            type: 'warning',
            title: 'Microphone Access Denied',
            message: 'Recording will continue without microphone audio',
            duration: 4000
          })
        }
      }

      setStream(finalStream)
      chunksRef.current = []
      setRecordingDuration(0)

      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
        setIsRecording(false)
        setIsPaused(false)
        
        // Add to history
        if (historyRef.current) {
          historyRef.current.addRecording(blob, recordingDuration)
        }
        
        const finalDuration = recordingDuration
        setRecordingDuration(0)
        
        // Show customer form after recording completion
        setShowCustomerForm(true)
        
        addNotification({
          type: 'success',
          title: 'Recording Complete!',
          message: `Recorded ${Math.floor(finalDuration / 60)}:${(finalDuration % 60).toString().padStart(2, '0')}`,
          duration: 4000
        })
      }

      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

      addNotification({
        type: 'info',
        title: 'Recording Started',
        message: 'Press SPACE to pause, ESC to stop.',
        duration: 3000
      })

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

      // Stop recording when user stops screen sharing
      finalStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording()
      })

    } catch (error) {
      console.error('Error starting recording:', error)
      addNotification({
        type: 'error',
        title: 'Recording Failed',
        message: 'Failed to start recording. Please make sure you grant screen sharing permissions.',
        duration: 6000
      })
    }
  }, [includeAudio, audioSource, quality, getQualitySettings, addNotification, recordingDuration, stopRecording])

  const downloadRecording = useCallback(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `screen-recording-${new Date().getTime()}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      addNotification({
        type: 'success',
        title: 'Download Started',
        message: 'Your recording is being downloaded.',
        duration: 3000
      })
    }
  }, [recordedBlob, addNotification])

  const clearRecording = useCallback(() => {
    setRecordedBlob(null)
    setShowCustomerForm(false)
    setCustomerName('')
    setCustomerEmail('')
    setRecordingDescription('')
  }, [])

  const handleCustomerFormSubmit = useCallback(async () => {
    if (!customerName.trim() || !customerEmail.trim()) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please enter both customer name and email.',
        duration: 3000
      })
      return
    }

    if (!recordedBlob) {
      addNotification({
        type: 'error',
        title: 'No Recording Found',
        message: 'Please record a video first.',
        duration: 3000
      })
      return
    }

    setShowCustomerForm(false)
    
    try {
      addNotification({
        type: 'info',
        title: 'Uploading to Vimeo',
        message: 'Please wait while we upload your recording...',
        duration: 5000
      })

      // Convert blob to file with customer info in filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const file = new File([recordedBlob], `${customerName.replace(/[^a-zA-Z0-9]/g, '_')}-recording-${timestamp}.webm`, {
        type: recordedBlob.type
      })

      // Create video title and description with customer info
      const videoTitle = `${customerName} - Screen Recording (${new Date().toLocaleString()})`
      const videoDescription = recordingDescription.trim() 
        ? `Screen recording session for ${customerName}.\n\nAdditional notes: ${recordingDescription}`
        : `Screen recording session for ${customerName}.`

      // Upload to Vimeo with customer information in metadata
      // Create a name mapping for liaison identification
      const getDisplayName = () => {
        if (profile?.display_name) return profile.display_name
        if (user?.user_metadata?.full_name) return user.user_metadata.full_name
        
        // Email-based name mapping for liaisons
        const emailToNameMap: { [key: string]: string } = {
          'john@tpnlife.com': 'John Bradshaw',
          'john+test@tpnlife.com': 'John Bradshaw',
          'john+admin@tpnlife.com': 'John Bradshaw',
          'john+1@tpnlife.com': 'John User',
          'john+2@tpnlife.com': 'John Manager',
          // Add other liaisons here as needed
        }
        
        if (user?.email) {
          // Check exact email match first
          if (emailToNameMap[user.email]) {
            return emailToNameMap[user.email]
          }
          
          // Check if it's a john+ variant
          if (user.email.startsWith('john+') && user.email.includes('@tpnlife.com')) {
            return 'John Bradshaw'
          }
        }
        
        // Fallback to email username
        return user?.email?.split('@')[0] || 'Unknown User'
      }

      const vimeoUri = await uploadVideoForUser(
        file, 
        customerName,
        customerEmail,
        getDisplayName(),
        videoTitle,
        videoDescription
      )
      
      if (vimeoUri) {
        addNotification({
          type: 'success',
          title: 'Upload Successful!',
          message: `Recording uploaded to Vimeo for ${customerName}`,
          duration: 5000
        })
      } else {
        throw new Error('No URI returned from Vimeo')
      }
    } catch (error) {
      console.error('Error uploading to Vimeo:', error)
      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload to Vimeo. You can still download the recording.',
        duration: 5000
      })
    }
  }, [customerName, customerEmail, recordingDescription, recordedBlob, uploadVideoForUser, addNotification])

  const skipCustomerForm = useCallback(() => {
    setShowCustomerForm(false)
    addNotification({
      type: 'info',
      title: 'Customer Form Skipped',
      message: 'You can still download or clear the recording.',
      duration: 3000
    })
  }, [addNotification])

  // Check if user can delete videos (only admins and supervisors)
  const canDeleteVideos = userRole === 'admin' || userRole === 'supervisor'

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (showHistory) {
    return (
      <div>
        <div className="mb-4 text-center">
          <button
            onClick={() => setShowHistory(false)}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            ← Back to Recorder
          </button>
        </div>
        <RecordingHistoryAdvanced ref={historyRef} />
      </div>
    )
  }

  return (
    <div>
      {/* Main Recording Interface - Constrained Width */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg px-[10px] py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <img 
              src="/Sparky AI.gif" 
              alt="Sparky AI Logo" 
              className="w-24 h-24 mx-auto"
            />
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowInstructions(true)}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Instructions
            </button>
          </div>
        </div>

        {/* Instructions Modal */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Instructions & Shortcuts</h2>
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">How to Record</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      <li>Configure your recording settings (quality, audio source)</li>
                      <li>Click "Start Recording" or press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">Space</kbd></li>
                      <li>Select the screen or window you want to record</li>
                      <li>Grant microphone permission if using microphone audio</li>
                      <li>Recording will start immediately</li>
                      <li>Use pause/resume during recording if needed</li>
                      <li>Click "Stop Recording" or press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">Esc</kbd> when done</li>
                      <li>Download or clear your recording</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Keyboard Shortcuts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-gray-700 dark:text-gray-300">Start/Pause Recording</span>
                          <kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm font-mono">Space</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-gray-700 dark:text-gray-300">Stop Recording</span>
                          <kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm font-mono">Esc</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-gray-700 dark:text-gray-300">Show Instructions</span>
                          <kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm font-mono">I</kbd>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-gray-700 dark:text-gray-300">Download Recording</span>
                          <kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm font-mono">D</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-gray-700 dark:text-gray-300">Clear Recording</span>
                          <kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm font-mono">C</kbd>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recording Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      <li>Choose "High" quality for crisp recordings (1920x1080, 30fps)</li>
                      <li>Enable audio to capture system sounds</li>
                      <li>Recordings are stored locally in your browser</li>
                      <li>Use pause/resume to create seamless recordings</li>
                      <li>Close unnecessary applications for better performance</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Browser Requirements</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      <li>Modern browsers: Chrome, Firefox, Safari, Edge</li>
                      <li>HTTPS connection required for screen capture</li>
                      <li>Allow screen sharing permissions when prompted</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center space-y-6">
          {/* Settings Panel */}
          {!isRecording && (
            <div className="w-full max-w-md bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white text-center">Recording Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="high">High (1920x1080, 30fps)</option>
                  <option value="medium">Medium (1280x720, 24fps)</option>
                  <option value="low">Low (854x480, 15fps)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Audio Source
                </label>
                <select
                  value={audioSource}
                  onChange={(e) => {
                    const newSource = e.target.value as 'none' | 'system' | 'microphone' | 'both'
                    setAudioSource(newSource)
                    setIncludeAudio(newSource !== 'none')
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="none">No Audio</option>
                  <option value="system">System Audio Only</option>
                  <option value="microphone">Microphone Only</option>
                  <option value="both">System Audio + Microphone</option>
                </select>
              </div>

              {audioSource !== 'none' && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeAudio"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="includeAudio" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    {audioSource === 'system' && 'Include system audio'}
                    {audioSource === 'microphone' && 'Include microphone audio'}
                    {audioSource === 'both' && 'Include system and microphone audio'}
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Live Preview During Recording */}
          {isRecording && stream && (
            <div className="w-full max-w-2xl">
              <div className="mb-4">
                <div className="relative">
                  <video
                    ref={(video) => {
                      if (video && stream) {
                        video.srcObject = stream
                      }
                    }}
                    autoPlay
                    muted
                    className="w-full rounded-lg shadow-md border-2 border-red-500"
                  />
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>RECORDING LIVE</span>
                  </div>
                  <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-mono">
                    {formatDuration(recordingDuration)}
                  </div>
                </div>
              </div>
              <div className="text-center text-gray-600 dark:text-gray-400">
                <p className="text-sm">Live preview of your screen recording</p>
              </div>
            </div>
          )}

          {/* Preview Window - Always Visible and Centered */}
          {!isRecording && !recordedBlob && (
            <div className="w-full max-w-2xl mb-6">
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Your recording will appear here</p>
                </div>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          {!isRecording && !recordedBlob && (
            <button
              onClick={startRecording}
              className="bg-gradient-to-b from-green-400 to-green-700 hover:from-green-500 hover:to-green-800 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-[0_8px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_4px_8px_rgba(0,0,0,0.2)] border border-green-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                <span className={`font-medium ${isPaused ? 'text-yellow-500' : 'text-red-500'}`}>
                  {isPaused ? 'Recording paused...' : 'Recording in progress...'}
                </span>
                <span className="text-gray-500 font-mono text-lg">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className={`${isPaused ? 'bg-blue-600 hover:bg-blue-700' : 'bg-yellow-500 hover:bg-yellow-600'} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2`}
                >
                  {isPaused ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1M9 16v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2H11a2 2 0 01-2-2z" />
                      </svg>
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                      </svg>
                      <span>Pause</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Recording Preview and Customer Form */}
          {recordedBlob && (
            <div className="w-full max-w-2xl">
              {showCustomerForm ? (
                /* Customer Information Form */
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    Customer Information
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                    Please provide customer details for this screen recording session.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter customer's full name"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Customer Email *
                      </label>
                      <input
                        type="email"
                        id="customerEmail"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Enter customer's email address"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="recordingDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Recording Description
                      </label>
                      <textarea
                        id="recordingDescription"
                        value={recordingDescription}
                        onChange={(e) => setRecordingDescription(e.target.value)}
                        placeholder="Describe what was covered in this recording session (optional)"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical"
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-4 justify-center mt-6">
                    <button
                      onClick={handleCustomerFormSubmit}
                      disabled={vimeoLoading}
                      className={`${
                        vimeoLoading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 transform hover:scale-105'
                      } text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl`}
                    >
                      {vimeoLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Uploading to Vimeo...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Save & Upload to Vimeo</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={skipCustomerForm}
                      disabled={vimeoLoading}
                      className={`${
                        vimeoLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-500 hover:bg-gray-600'
                      } text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Skip</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Video Preview and Controls */
                <>
                  <div className="mb-4">
                    <video
                      controls
                      className="w-full rounded-lg shadow-md"
                      src={URL.createObjectURL(recordedBlob)}
                    />
                  </div>
                  <div className="flex space-x-4 justify-center">
                    <button
                      onClick={downloadRecording}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Download</span>
                    </button>
                    {canDeleteVideos && (
                      <button
                        onClick={clearRecording}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Clear</span>
                      </button>
                    )}
                    {canDeleteVideos && (
                      <button
                        onClick={() => {
                          clearRecording()
                          setTimeout(startRecording, 100)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Record Again</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowCustomerForm(true)}
                      className="bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Customer Info</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Your Videos Panel - Full Width, Outside Main Container */}
      <div className="w-full flex justify-center px-4 mt-8">
        <div className="w-full max-w-[1800px] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
          <UserVideos />
        </div>
      </div>
    </div>
  )
}
