// filepath: c:\sr97\src\app\page-minimal.tsx
'use client'

import { useState } from 'react'

export default function RecordingPage() {
  const [isRecording, setIsRecording] = useState(false)

  const startRecording = async () => {
    try {
      console.log('🎬 Starting screen recording...')

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

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
        console.log('✅ Recording completed, blob size:', blob.size)
      }

      recorder.start()
      setIsRecording(true)
      console.log('🔴 Recording started')

    } catch (error) {
      console.error('❌ Error starting recording:', error)
      alert('Failed to start recording. Please ensure you grant screen sharing permissions.')
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    console.log('⏹️ Recording stopped')
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Screen Recorder
            </h1>

            <div className="flex justify-center gap-4 mb-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-8 py-4 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-8 py-4 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white"
                >
                  Stop Recording
                </button>
              )}
            </div>

            {isRecording && (
              <div className="text-red-600 dark:text-red-400 font-medium">
                🔴 Recording in progress...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}