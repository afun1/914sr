// This component has been consolidated into the main folders page
// All functionality is available at /folders

export default function FolderManagerWithButton() {
  return (
    <div className="text-center p-8">
      <h2 className="text-xl font-semibold mb-4">Folder Management</h2>
      <p className="text-gray-600 mb-4">
        All folder management features are now available on the dedicated folders page.
      </p>
      <a 
        href="/folders" 
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Go to Folder Manager
      </a>
    </div>
  )
}