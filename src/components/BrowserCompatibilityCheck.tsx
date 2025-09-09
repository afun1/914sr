'use client'

import { useEffect, useState } from 'react'

interface BrowserCompatibility {
  mediaRecorder: boolean
  getDisplayMedia: boolean
  isSupported: boolean
  warnings: string[]
}

export function useBrowserCompatibility(): BrowserCompatibility {
  const [compatibility, setCompatibility] = useState<BrowserCompatibility>({
    mediaRecorder: false,
    getDisplayMedia: false,
    isSupported: false,
    warnings: []
  })

  useEffect(() => {
    const checkCompatibility = () => {
      const warnings: string[] = []
      const mediaRecorder = typeof MediaRecorder !== 'undefined'
      const getDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)

      if (!mediaRecorder) {
        warnings.push('MediaRecorder API is not supported in this browser')
      }

      if (!getDisplayMedia) {
        warnings.push('Screen capture is not supported in this browser')
      }

      // Check for HTTPS requirement
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        warnings.push('Screen recording requires HTTPS connection')
      }

      // Browser-specific warnings
      const userAgent = navigator.userAgent.toLowerCase()
      if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        warnings.push('Safari has limited screen recording support')
      }

      if (userAgent.includes('firefox')) {
        warnings.push('Firefox may have limited codec support for screen recording')
      }

      setCompatibility({
        mediaRecorder,
        getDisplayMedia,
        isSupported: mediaRecorder && getDisplayMedia,
        warnings
      })
    }

    checkCompatibility()
  }, [])

  return compatibility
}

interface BrowserCompatibilityCheckProps {
  children: React.ReactNode
}

export default function BrowserCompatibilityCheck({ children }: BrowserCompatibilityCheckProps) {
  const compatibility = useBrowserCompatibility()

  if (!compatibility.isSupported) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <svg 
              className="mx-auto h-12 w-12 text-orange-500 mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Browser Not Supported
            </h2>
            <p className="text-gray-600 mb-4">
              Your browser doesn&apos;t support screen recording features.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {compatibility.warnings.map((warning, index) => (
              <div key={index} className="flex items-start space-x-2">
                <svg 
                  className="w-5 h-5 text-red-500 mt-0.5" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <span className="text-sm text-gray-700">{warning}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-medium text-blue-900 mb-2">Recommended Browsers:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Google Chrome (latest version)</li>
              <li>• Microsoft Edge (latest version)</li>
              <li>• Mozilla Firefox (latest version)</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (compatibility.warnings.length > 0) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-2">
            <svg 
              className="w-5 h-5 text-yellow-600" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                clipRule="evenodd" 
              />
            </svg>
            <span className="text-sm text-yellow-800">
              Browser limitations detected: {compatibility.warnings.join(', ')}
            </span>
          </div>
        </div>
        {children}
      </div>
    )
  }

  return <>{children}</>
}
