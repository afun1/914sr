// Simple Add Folder Button - Add this to your existing button row
{/* Add this button between your Refresh and No Duplicates buttons */}

<button
  onClick={async () => {
    const nicolaasEmail = prompt('Enter user email (e.g., nicolaas.phg@gmail.com):')
    const displayName = prompt('Enter display name (e.g., Nicolaas):')
    
    if (nicolaasEmail && displayName) {
      try {
        const response = await fetch('/api/folders/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-user-folder',
            userEmail: nicolaasEmail,
            displayName: displayName
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert(`✅ Folder created successfully! 
          
User: ${displayName}
Videos imported: ${result.videosImported || 0}

They can now see their videos in "Your Recordings"!`)
        } else {
          alert(`❌ Error: ${result.error}`)
        }
        
      } catch (error) {
        alert('Failed to create folder')
      }
    }
  }}
  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
  Add Folder
</button>