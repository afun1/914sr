import { NextRequest, NextResponse } from 'next/server'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API_BASE = 'https://api.vimeo.com'

if (!VIMEO_ACCESS_TOKEN) {
  console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables')
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔥 Vimeo folders API called')
    
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    // Get all folders from Vimeo
    const response = await fetch(`${VIMEO_API_BASE}/me/projects`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Vimeo API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch folders from Vimeo' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('📁 Raw folders from Vimeo:', data.data?.length || 0)

    // Get videos for each folder
    const foldersWithVideos = await Promise.all(
      data.data.map(async (folder: any) => {
        try {
          const videosResponse = await fetch(`${VIMEO_API_BASE}${folder.uri}/videos?per_page=100&fields=uri,name,description,duration,created_time,pictures.sizes,privacy,stats`, {
            headers: {
              'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          })

          if (videosResponse.ok) {
            const videosData = await videosResponse.json()
            return {
              ...folder,
              videos: videosData.data || []
            }
          } else {
            console.warn(`⚠️ Failed to fetch videos for folder ${folder.name}`)
            return {
              ...folder,
              videos: []
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching videos for folder ${folder.name}:`, error)
          return {
            ...folder,
            videos: []
          }
        }
      })
    )

    // Filter to only process Sparky Screen Recordings folder
    const sparkyFolders = foldersWithVideos.filter(folder => 
      folder.name && (
        folder.name.toLowerCase().includes('sparky') && 
        folder.name.toLowerCase().includes('screen') &&
        folder.name.toLowerCase().includes('recording')
      )
    )

    console.log('📁 Filtered to Sparky folders only:', sparkyFolders.length)
    console.log('📁 Sparky folder names:', sparkyFolders.map(f => f.name))

    // Process videos ONLY from Sparky folders
    const allVideos: any[] = []
    
    // Collect videos only from Sparky folders (not Team Library or other folders)
    sparkyFolders.forEach(folder => {
      if (folder.videos && folder.videos.length > 0) {
        folder.videos.forEach((video: any) => {
          allVideos.push({
            ...video,
            originalFolder: folder.name
          })
        })
      }
    })

    console.log('🎥 Total videos from Sparky folders:', allVideos.length)

    // Group videos by liaison
    const videosByLiaison: { [liaisonName: string]: any[] } = {}
    
    allVideos.forEach(video => {
      // Extract liaison from video description
      const description = video.description || ''
      let liaisonName = 'Unknown Liaison'
      
      // Try different patterns to extract liaison name
      const liaisonMatch1 = description.match(/Liaison:\s*([^\n\r]+?)(?:\s+Recorded:|$)/i)
      const liaisonMatch2 = description.match(/Recorded by:\s*([^\n\r]+?)(?:\s+Timestamp:|$)/i)
      
      if (liaisonMatch1) {
        liaisonName = liaisonMatch1[1].trim()
      } else if (liaisonMatch2) {
        liaisonName = liaisonMatch2[1].trim()
      }
      
      // Initialize liaison group if it doesn't exist
      if (!videosByLiaison[liaisonName]) {
        videosByLiaison[liaisonName] = []
      }
      
      videosByLiaison[liaisonName].push(video)
    })

    // Create virtual liaison folders
    const liaisonFolders = Object.entries(videosByLiaison).map(([liaisonName, videos]) => ({
      uri: `/liaison-folders/${encodeURIComponent(liaisonName)}`,
      name: liaisonName,
      description: `Videos recorded by ${liaisonName}`,
      created_time: videos[0]?.created_time || new Date().toISOString(),
      modified_time: videos[0]?.created_time || new Date().toISOString(),
      videos: videos,
      isLiaisonFolder: true,
      videoCount: videos.length
    }))

    // Find the main Sparky folder from the filtered results
    const sparkyFolder = sparkyFolders[0] // Should be the Sparky Screen Recordings folder

    // Start with the main Sparky folder at the top
    const allFolders = []
    
    if (sparkyFolder) {
      allFolders.push({
        ...sparkyFolder,
        name: sparkyFolder.name, // Keep original name like "Sparky Screen Recordings"
        isMainFolder: true,
        videos: allVideos // All videos for the main repository view
      })
    }

    // Add liaison folders after the main folder
    allFolders.push(...liaisonFolders)

    console.log('📁 Main Sparky folder:', sparkyFolder?.name || 'Not found')
    console.log('📁 Organized into liaison folders:', liaisonFolders.length)
    console.log('👥 Liaisons found:', Object.keys(videosByLiaison))

    return NextResponse.json({
      folders: allFolders,
      total: allFolders.length
    })
  } catch (error) {
    console.error('❌ Error in folders API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const deleteId = url.searchParams.get('delete')

    if (!deleteId) {
      return NextResponse.json(
        { error: 'Folder ID is required for deletion' },
        { status: 400 }
      )
    }

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    console.log('🗑️ Deleting Vimeo folder with ID:', deleteId)

    // Delete folder from Vimeo
    const response = await fetch(`${VIMEO_API_BASE}/me/projects/${deleteId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Vimeo folder deletion failed:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Error details:', errorText)
      
      return NextResponse.json(
        { error: `Failed to delete folder from Vimeo: ${response.statusText}` },
        { status: response.status }
      )
    }

    console.log('✅ Folder deleted successfully from Vimeo')

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error in folder deletion API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}