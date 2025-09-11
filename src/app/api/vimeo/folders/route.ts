import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🗂️ Fetching Sparky Screen Recordings folders...')
    
    const response = await fetch('https://api.vimeo.com/me/projects?per_page=100', {
      headers: {
        'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Vimeo API error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`📁 Found ${data.data.length} total Vimeo folders`)
    
    // Filter to only show Sparky Screen Recordings related folders
    const sparkyFolders = data.data.filter((project: any) => {
      const name = project.name.toLowerCase()
      return (
        (name.includes('sparky') ||
        name.includes('screen recording') ||
        name.includes('ssr') ||
        (name.includes('screen') && name.includes('recording')) ||
        // Include user-specific folders that are related to screen recordings
        (name.includes('recording') && !name.includes('test')) ||
        // Include main Sparky folder
        name === 'sparky screen recordings') &&
        // EXCLUDE Zoom recordings
        !name.includes('zoom') &&
        !name.includes('zoom recording') &&
        !name.includes('meeting')
      )
    })
    
    console.log(`✅ Found ${sparkyFolders.length} Sparky-related folders`)
    
    // Transform filtered folders for the frontend
    const foldersWithCounts = await Promise.all(sparkyFolders.map(async (project: any) => {
      // Get accurate video count by fetching videos from each folder
      let actualVideoCount = project.stats?.videos || 0
      
      try {
        // Fetch actual video count from the folder
        const videosResponse = await fetch(`https://api.vimeo.com/me/projects/${project.uri.split('/').pop()}/videos?per_page=1`, {
          headers: {
            'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        })
        
        if (videosResponse.ok) {
          const videosData = await videosResponse.json()
          actualVideoCount = videosData.total || 0
        }
      } catch (error) {
        console.log(`Could not fetch video count for ${project.name}:`, error)
      }
      
      return {
        id: project.uri.split('/').pop(),
        name: project.name,
        description: project.description || 'Screen recordings folder',
        video_count: actualVideoCount,
        created_time: project.created_time,
        modified_time: project.modified_time,
        uri: project.uri,
        link: project.link,
        // Add indicator if this is the main Sparky folder
        is_main_folder: project.name.toLowerCase() === 'sparky screen recordings'
      }
    }))
    
    // Sort to put main Sparky folder first
    foldersWithCounts.sort((a: any, b: any) => {
      if (a.is_main_folder) return -1
      if (b.is_main_folder) return 1
      return a.name.localeCompare(b.name)
    })
    
    return NextResponse.json({
      success: true,
      folders: foldersWithCounts,
      total: foldersWithCounts.length,
      filtered_from: data.data.length
    })
    
  } catch (error) {
    console.error('❌ Error fetching Sparky folders:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch Sparky folders',
        folders: []
      },
      { status: 500 }
    )
  }
}