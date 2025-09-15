// filepath: c:\sr97\src\app\test\page.tsx
"use client"

import { useState, useEffect } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testAPI = async () => {
      try {
        console.log('🧪 Testing API routes...')
        const response = await fetch('/api/simple')

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('✅ API test result:', data)
        setResult(data)
      } catch (err) {
        console.error('❌ API test failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    testAPI()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🧪</div>
          <h1 className="text-2xl font-bold mb-2">Testing API Routes</h1>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2 text-red-600">API Test Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Check the browser console for more details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto p-8">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-4 text-green-600">API Routes Working!</h1>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-4">
          <h2 className="text-lg font-semibold mb-2">Test Results:</h2>
          <pre className="text-left text-sm bg-gray-200 dark:bg-gray-700 p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>

        <div className="text-sm text-gray-600">
          <p>If you see this, API routes are working correctly!</p>
          <p>The issue might be with the specific Vimeo API integration.</p>
        </div>
      </div>
    </div>
  )
}