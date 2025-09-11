// Script to immediately set up Nicolaas's folder and import his video
// Run this to create his folder right now!

async function setupNicolaasFolder() {
  try {
    console.log('🎉 Setting up Nicolaas folder...')
    
    const response = await fetch('/api/folders/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'setup-nicolaas'
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ SUCCESS!')
      console.log('📁 Folder created:', result.folder.name)
      console.log('🎥 Video imported:', result.videoImported ? 'Yes' : 'No')
      
      alert(`Nicolaas folder created successfully! 
      
Folder: ${result.folder.name}
Video imported: ${result.videoImported ? 'Yes' : 'No'}`)
      
    } else {
      console.error('❌ Error:', result.error)
      alert('Error creating folder: ' + result.error)
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
    alert('Setup failed: ' + error.message)
  }
}

// Auto-run when page loads
if (typeof window !== 'undefined') {
  setupNicolaasFolder()
}

export default setupNicolaasFolder