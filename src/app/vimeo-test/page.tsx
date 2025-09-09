'use client'

import { useState } from 'react'

export default function VimeoTest() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testTeamAccess = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/vimeo?action=test-team')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/vimeo?action=test')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createMainFolder = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/vimeo?action=create-main-folder')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getTeamFolders = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/vimeo?action=team-folders')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createTeamProject = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/vimeo?action=create-team-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: 'Sparky Screen Recordings' })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Vimeo Integration Test</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Connection</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Test if the Vimeo API credentials are working correctly.
          </p>
          
          <button
            onClick={testConnection}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-b from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <span>🔗</span>
                <span>Test Connection</span>
              </>
            )}
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Team Access</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Test if your enterprise account has team library access.
          </p>
          
          <button
            onClick={testTeamAccess}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <span>🏢</span>
                <span>Test Team Access</span>
              </>
            )}
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create Main Folder</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            This will create the main "Sparky Screen Recordings" folder in your Vimeo Team Library.
          </p>
          
          <button
            onClick={createMainFolder}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span>📁</span>
                <span>Create Main Folder</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Check Team Folders</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            View all folders/projects in your Vimeo Team Library.
          </p>
          
          <button
            onClick={getTeamFolders}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>View Team Projects</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create Team Project</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Create a new "Sparky Screen Recordings" project in your Vimeo Team Library.
          </p>
          
          <button
            onClick={createTeamProject}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-b from-indigo-400 to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span>🎯</span>
                <span>Create Team Project</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
