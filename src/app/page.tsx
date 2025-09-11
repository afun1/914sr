'use client'

// Simple home page - focus on recorder and folders for morning
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Sparky Screen Recorder
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Welcome to the screen recording system
        </p>
        <div className="space-y-4">
          <div>
            <a 
              href="/record" 
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-4"
            >
              🎬 Start Recording
            </a>
          </div>
          <div>
            <a 
              href="/folders" 
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              📁 Manage Folders
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
