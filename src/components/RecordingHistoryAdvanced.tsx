'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'

interface Recording {
  id: string
  name: string
  duration: number
  size: number
  timestamp: Date
  blob: Blob
  thumbnail?: string
}

interface RecordingHistoryRef {
  addRecording: (blob: Blob, duration: number) => void
}

const RecordingHistoryAdvanced = forwardRef<RecordingHistoryRef>((props, ref) => {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)

  // Expose addRecording function to parent component
  useImperativeHandle(ref, () => ({
    addRecording: (blob: Blob, duration: number) => {
      const newRecording: Recording = {
        id: Date.now().toString(),
        name: `Recording ${new Date().toLocaleString()}`,
        duration,
        size: blob.size,
        timestamp: new Date(),
        blob
      }

      // Generate thumbnail
      generateThumbnail(blob).then(thumbnail => {
        newRecording.thumbnail = thumbnail
        setRecordings(prev => [newRecording, ...prev])
      })
    }
  }), [])

  // Load recordings from localStorage on mount
  useEffect(() => {
    const savedRecordings = localStorage.getItem('screen-recordings')
    if (savedRecordings) {
      try {
        const parsed = JSON.parse(savedRecordings) as Recording[]
        setRecordings(parsed.map((r) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        })))
      } catch (error) {
        console.error('Error loading recordings:', error)
      }
    }
  }, [])

  // Save recordings to localStorage
  useEffect(() => {
    localStorage.setItem('screen-recordings', JSON.stringify(recordings))
  }, [recordings])

  const generateThumbnail = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      video.onloadedmetadata = () => {
        canvas.width = 160
        canvas.height = 90
        video.currentTime = Math.min(1, video.duration / 2) // Seek to middle or 1 second
      }
      
      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        } else {
          resolve('')
        }
      }
      
      video.src = URL.createObjectURL(blob)
    })
  }

  const deleteRecording = (id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id))
    if (selectedRecording?.id === id) {
      setSelectedRecording(null)
    }
  }

  const downloadRecording = (recording: Recording) => {
    const url = URL.createObjectURL(recording.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${recording.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const renameRecording = (id: string, newName: string) => {
    setRecordings(prev => prev.map(r => 
      r.id === id ? { ...r, name: newName } : r
    ))
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <img 
              src="/Sparky AI.gif" 
              alt="Sparky AI Logo" 
              className="w-10 h-10"
            />
            <h2 className="text-2xl font-bold text-gray-900">
              Sparky Recording History
            </h2>
          </div>
          <p className="text-gray-600 mt-1">
            Manage and view your saved screen recordings
          </p>
        </div>

        {recordings.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings yet</h3>
            <p className="text-gray-500">Start recording your screen to see your recordings here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Recordings List */}
            <div className="lg:col-span-2 space-y-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedRecording?.id === recording.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedRecording(recording)}
                >
                  <div className="flex items-start space-x-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      {recording.thumbnail ? (
                        <img
                          src={recording.thumbnail}
                          alt="Recording thumbnail"
                          className="w-20 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Recording Info */}
                    <div className="flex-grow min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {recording.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {recording.timestamp.toLocaleDateString()} at {recording.timestamp.toLocaleTimeString()}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span>{formatDuration(recording.duration)}</span>
                        <span>{formatFileSize(recording.size)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadRecording(recording)
                        }}
                        className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteRecording(recording.id)
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recording Preview */}
            <div className="lg:col-span-1">
              {selectedRecording ? (
                <div className="sticky top-6">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-4">Preview</h3>
                    <video
                      controls
                      className="w-full rounded-lg shadow-sm"
                      src={URL.createObjectURL(selectedRecording.blob)}
                      poster={selectedRecording.thumbnail}
                    />
                    <div className="mt-4 space-y-2">
                      <input
                        type="text"
                        value={selectedRecording.name}
                        onChange={(e) => renameRecording(selectedRecording.id, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="Recording name"
                      />
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Duration: {formatDuration(selectedRecording.duration)}</div>
                        <div>Size: {formatFileSize(selectedRecording.size)}</div>
                        <div>Created: {selectedRecording.timestamp.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">
                    Select a recording to preview
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

RecordingHistoryAdvanced.displayName = 'RecordingHistoryAdvanced'

export default RecordingHistoryAdvanced
export type { Recording, RecordingHistoryRef }
