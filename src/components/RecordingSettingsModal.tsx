'use client'

import { useState } from 'react'

export interface RecordingSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra'
  audioEnabled: boolean
  frameRate: number
}

const qualityPresets = {
  low: { width: 720, height: 480, bitrate: 1000 },
  medium: { width: 1280, height: 720, bitrate: 2500 },
  high: { width: 1920, height: 1080, bitrate: 5000 },
  ultra: { width: 2560, height: 1440, bitrate: 8000 }
}

interface RecordingSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: RecordingSettings
  onSettingsChange: (settings: RecordingSettings) => void
}

export default function RecordingSettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange
}: RecordingSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<RecordingSettings>(settings)

  const handleSave = () => {
    onSettingsChange(localSettings)
    onClose()
  }

  const handleReset = () => {
    const defaultSettings: RecordingSettings = {
      quality: 'high',
      audioEnabled: true,
      frameRate: 30
    }
    setLocalSettings(defaultSettings)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recording Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Quality Setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Video Quality
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(qualityPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setLocalSettings({ ...localSettings, quality: key as keyof typeof qualityPresets })}
                  className={`p-3 text-left rounded-lg border transition-colors ${
                    localSettings.quality === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium capitalize">{key}</div>
                  <div className="text-xs text-gray-500">
                    {preset.width}×{preset.height}
                  </div>
                  <div className="text-xs text-gray-500">
                    ~{preset.bitrate}kbps
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Frame Rate: {localSettings.frameRate} FPS
            </label>
            <input
              type="range"
              min="15"
              max="60"
              step="15"
              value={localSettings.frameRate}
              onChange={(e) => setLocalSettings({ 
                ...localSettings, 
                frameRate: parseInt(e.target.value) 
              })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>15</span>
              <span>30</span>
              <span>45</span>
              <span>60</span>
            </div>
          </div>

          {/* Audio Setting */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={localSettings.audioEnabled}
                onChange={(e) => setLocalSettings({ 
                  ...localSettings, 
                  audioEnabled: e.target.checked 
                })}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-700">Include Audio</div>
                <div className="text-sm text-gray-500">
                  Record system audio along with video
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-md font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
