import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userName = searchParams.get('userName')
    
    if (!userName) {
      return NextResponse.json(
        { success: false, error: 'User name is required' },
        { status: 400 }
      )
    }

    // Hybrid approach: Look for user-specific folder first, fallback to main folder
    
    // Step 1: Get all folders to find user-specific folder
    const foldersResponse = await fetch('https://api.vimeo.com/me/folders?per_page=100', {
      headers: {
        'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })

    if (!foldersResponse.ok) {
      throw new Error(`Vimeo API Error: ${foldersResponse.status} ${foldersResponse.statusText}`)
    }

    const foldersData = await foldersResponse.json()
    const folders = foldersData.data || []

    // Look for user-specific folder first
    const userFolder = folders.find((folder: any) => {
      const folderName = folder.name.toLowerCase()
      const searchName = userName.toLowerCase()
      
      return (
        folderName === searchName || // Exact match
        folderName.includes(`/${searchName}`) || // Virtual path match
        folderName.includes(searchName) // Partial match
      )
    })

    let targetFolder = userFolder
    let allVideos: any[] = []

    if (userFolder) {
      // User has their own folder - get videos from it
      console.log(`📁 Found user folder: ${userFolder.name}`)
      const folderId = userFolder.uri.split('/').pop()
      const videosResponse = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos?per_page=100&fields=uri,name,description,duration,created_time,modified_time,link,player_embed_url`, {
        headers: {
          'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })

      if (videosResponse.ok) {
        const videosData = await videosResponse.json()
        allVideos = videosData.data || []
      }
    } else {
      // No user folder found - search main Sparky folder and filter by user
      console.log(`📁 No user folder found, searching main folder for ${userName}'s videos`)
      const mainFolderId = '26555277'
      
      const folderResponse = await fetch(`https://api.vimeo.com/me/folders/${mainFolderId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      })

      if (folderResponse.ok) {
        targetFolder = await folderResponse.json()
        targetFolder.name = `${targetFolder.name} (${userName}'s Videos)`
      }

      // Get all videos from main folder and filter by user
      const videosResponse = await fetch(`https://api.vimeo.com/me/folders/${mainFolderId}/videos?per_page=100&fields=uri,name,description,duration,created_time,modified_time,link,player_embed_url`, {
        headers: {
          'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })

      if (videosResponse.ok) {
        const videosData = await videosResponse.json()
        const mainFolderVideos = videosData.data || []
        
        // Filter videos by user name in the video title or description
        allVideos = mainFolderVideos.filter((video: any) => {
          const title = video.name?.toLowerCase() || ''
          const description = video.description?.toLowerCase() || ''
          const searchName = userName.toLowerCase()
          
          return title.includes(`[${searchName}]`) || 
                 description.includes(`recorded by: ${userName}`) ||
                 description.includes(`recorded by: ${searchName}`)
        })
      }
    }

    return NextResponse.json({
      success: true,
      folder: {
        ...targetFolder,
        video_count: allVideos.length
      },
      videos: allVideos
    })

  } catch (error) {
    console.error('Failed to search user folder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search user folder' },
      { status: 500 }
    )
  }
}
