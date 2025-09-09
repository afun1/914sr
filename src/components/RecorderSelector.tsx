'use client'

import { useState } from 'react'
import AdvancedScreenRecorderWrapper from './AdvancedScreenRecorderWrapper'
import SmoothScreenRecorder from './SmoothScreenRecorder'
import UserVideos from './UserVideos'
import { useUser } from './AuthWrapper'

export default function RecorderSelector() {
  const [recorderType, setRecorderType] = useState<'advanced' | 'smooth'>('smooth')
  const { profile } = useUser()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Render Selected Recorder */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {recorderType === 'smooth' ? (
          <SmoothScreenRecorder />
        ) : (
          <AdvancedScreenRecorderWrapper />
        )}
        
        {/* Your Videos Panel */}
        <div className="mt-12">
          <UserVideos />
        </div>
      </div>
    </div>
  )
}
