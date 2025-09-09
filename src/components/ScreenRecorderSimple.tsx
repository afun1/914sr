'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNotifications } from './NotificationSystem'

export default function ScreenRecorder() {
  const { addNotification } = useNotifications()
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [includeAudio, setIncludeAudio] = useState(true)
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Space bar to start/stop recording (when not typing in input fields)
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault()
        if (isRecording) {
          stopRecording()
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
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isRecording, recordedBlob])

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
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording, stream])

  const startRecording = useCallback(async () => {
    try {
      const qualitySettings = getQualitySettings()
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: qualitySettings,
        audio: includeAudio
      })

      setStream(mediaStream)
      chunksRef.current = []
      setRecordingDuration(0)

      const mediaRecorder = new MediaRecorder(mediaStream, {
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
        setRecordingDuration(0)
        
        addNotification({
          type: 'success',
          title: 'Recording Complete!',
          message: `Your screen recording is ready for download.`,
          duration: 4000
        })
      }

      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

      addNotification({
        type: 'info',
        title: 'Recording Started',
        message: 'Press SPACE or ESC to stop recording.',
        duration: 3000
      })

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

      // Stop recording when user stops screen sharing
      mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
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
  }, [stopRecording, includeAudio, quality, getQualitySettings, addNotification])

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
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Screen Recorder
          </h2>
          <p className="text-gray-600">
            Record your screen with audio in high quality
          </p>
        </div>

        <div className="flex flex-col items-center space-y-6">
          {/* Settings Panel */}
          {!isRecording && (
            <div className="w-full max-w-md bg-gray-50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900 text-center">Recording Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="high">High (1920x1080, 30fps)</option>
                  <option value="medium">Medium (1280x720, 24fps)</option>
                  <option value="low">Low (854x480, 15fps)</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeAudio"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeAudio" className="ml-2 block text-sm text-gray-700">
                  Include system audio
                </label>
              </div>
            </div>
          )}

          {!isRecording && !recordedBlob && (
            <button
              onClick={startRecording}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors flex items-center space-x-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-500 font-medium">Recording in progress...</span>
                <span className="text-gray-500 font-mono text-lg">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              <button
                onClick={stopRecording}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span>Stop Recording</span>
              </button>
            </div>
          )}

          {recordedBlob && (
            <div className="w-full max-w-2xl">
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
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download</span>
                </button>
                <button
                  onClick={clearRecording}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Clear</span>
                </button>
                <button
                  onClick={() => {
                    clearRecording()
                    setTimeout(startRecording, 100)
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Record Again</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Instructions:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Configure quality and audio settings</li>
              <li>• Click &ldquo;Start Recording&rdquo; to begin screen capture</li>
              <li>• Select the screen or window you want to record</li>
              <li>• Click &ldquo;Stop Recording&rdquo; when finished</li>
              <li>• Preview your recording and download if satisfied</li>
              <li>• Recordings are saved locally to your device</li>
            </ul>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Keyboard Shortcuts:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs font-mono">SPACE</kbd> Start/Stop recording</li>
              <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs font-mono">ESC</kbd> Stop recording</li>
              <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs font-mono">Ctrl+D</kbd> Download recording</li>
              <li>• <kbd className="px-2 py-1 bg-white rounded border text-xs font-mono">Ctrl+R</kbd> Record again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
