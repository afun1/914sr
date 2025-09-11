// Vimeo API configuration and folder management
const VIMEO_CONFIG = {
  SPARKY_FOLDER_ID: '26741835', // Main "Sparky Screen Recordings" folder ID
  TEAM_ID: 'your-team-id', // Your Vimeo team ID
  ACCESS_TOKEN: process.env.VIMEO_ACCESS_TOKEN
}

// Function to ensure video goes to Sparky Screen Recordings folder
export async function uploadToSparkyFolder(videoFile: File, userMetadata: any) {
  try {
    console.log('🎥 Uploading video to Sparky Screen Recordings folder...')
    
    // 1. Upload video to Vimeo
    const uploadResponse = await fetch('https://api.vimeo.com/me/videos', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${VIMEO_CONFIG.ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      },
      body: JSON.stringify({
        upload: {
          approach: 'tus',
          size: videoFile.size
        },
        name: `${userMetadata.displayName || userMetadata.email} - ${new Date().toISOString()}`,
        description: `Screen recording by ${userMetadata.displayName || userMetadata.email}`,
        privacy: {
          view: 'team' // Team library visibility
        }
      })
    })
    
    const uploadData = await uploadResponse.json()
    console.log('✅ Video upload initiated:', uploadData.uri)
    
    // 2. Move video to Sparky Screen Recordings folder (NOT create new folder)
    await moveVideoToSparkyFolder(uploadData.uri)
    
    // 3. Add to user's folder in folder manager
    const { addVideoToUserFolder } = await import('./folder-manager')
    await addVideoToUserFolder(userMetadata.email, {
      vimeoId: uploadData.uri.split('/').pop(),
      title: `Recording ${new Date().toLocaleDateString()}`,
      description: `Screen recording by ${userMetadata.displayName || userMetadata.email}`,
      userDisplayName: userMetadata.displayName,
      createdAt: new Date().toISOString()
    })
    
    // 4. Return video data for app storage
    return {
      vimeoId: uploadData.uri.split('/').pop(),
      vimeoUri: uploadData.uri,
      uploadUrl: uploadData.upload.upload_link,
      folderPath: 'Sparky Screen Recordings', // Always this folder in Vimeo
      userFolder: userMetadata.email, // For app organization only
      createdAt: new Date().toISOString()
    }
    
  } catch (error) {
    console.error('❌ Error uploading to Sparky folder:', error)
    throw error
  }
}

// Function to move video to existing Sparky folder
async function moveVideoToSparkyFolder(videoUri: string) {
  try {
    console.log('📁 Moving video to Sparky Screen Recordings folder...')
    
    const response = await fetch(`https://api.vimeo.com/me/projects/${VIMEO_CONFIG.SPARKY_FOLDER_ID}/videos`, {
      method: 'PUT',
      headers: {
        'Authorization': `bearer ${VIMEO_CONFIG.ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [videoUri]
      })
    })
    
    if (response.ok) {
      console.log('✅ Video successfully moved to Sparky Screen Recordings')
    } else {
      console.error('❌ Failed to move video to folder:', await response.text())
    }
    
  } catch (error) {
    console.error('❌ Error moving video to folder:', error)
  }
}

// Function to fetch videos from Sparky folder for app display
export async function fetchSparkyFolderVideos() {
  try {
    console.log('📥 Fetching videos from Sparky Screen Recordings folder...')
    
    const response = await fetch(`https://api.vimeo.com/me/projects/${VIMEO_CONFIG.SPARKY_FOLDER_ID}/videos?per_page=100`, {
      headers: {
        'Authorization': `bearer ${VIMEO_CONFIG.ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })
    
    const data = await response.json()
    console.log(`✅ Found ${data.data.length} videos in Sparky folder`)
    
    return data.data.map((video: any) => ({
      vimeoId: video.uri.split('/').pop(),
      title: video.name,
      description: video.description,
      thumbnail: video.pictures?.sizes?.[2]?.link,
      duration: video.duration,
      createdAt: video.created_time,
      playerUrl: video.player_embed_url
    }))
    
  } catch (error) {
    console.error('❌ Error fetching Sparky folder videos:', error)
    return []
  }
}