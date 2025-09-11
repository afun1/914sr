import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId } = await params
    console.log(`🎥 Fetching videos from folder ID: ${folderId}`)
    
    const response = await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos?per_page=100`, {
      headers: {
        'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Vimeo API error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`✅ Found ${data.data.length} videos in folder`)
    
    // Transform video data for the frontend
    const videos = data.data.map((video: any) => ({
      id: video.uri.split('/').pop(),
      title: video.name,
      description: video.description,
      duration: video.duration,
      created_time: video.created_time,
      modified_time: video.modified_time,
      thumbnail: video.pictures?.sizes?.find((size: any) => size.width >= 640)?.link || 
                video.pictures?.sizes?.[0]?.link,
      embed_url: video.player_embed_url,
      link: video.link,
      uri: video.uri,
      // Extract user info from title if available
      user_info: extractUserFromTitle(video.name)
    }))
    
    return NextResponse.json({
      success: true,
      videos: videos,
      total: data.total,
      folder_id: folderId
    })
    
  } catch (error) {
    console.error('❌ Error fetching folder videos:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch folder videos',
        videos: []
      },
      { status: 500 }
    )
  }
}

// Helper function to extract user info from video title
function extractUserFromTitle(title: string) {
  // Titles are typically in format: "User Name - timestamp" or "email@domain.com - timestamp"
  const parts = title.split(' - ')
  if (parts.length >= 2) {
    return {
      display_name: parts[0],
      is_email: parts[0].includes('@')
    }
  }
  return null
}