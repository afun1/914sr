import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId } = await params
    console.log(`🎥 Fetching videos from folder ID: ${folderId}`)
    
    const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
    if (!VIMEO_ACCESS_TOKEN) {
      throw new Error('Vimeo access token not configured')
    }

    // Fetch videos from the specific Vimeo folder
    const vimeoResponse = await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos?per_page=50`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })
    
    if (!vimeoResponse.ok) {
      throw new Error(`Vimeo API error: ${vimeoResponse.status}`)
    }
    
    const videosData = await vimeoResponse.json()
    console.log('🎬 Raw videos response from Vimeo:', { 
      count: videosData.data?.length, 
      firstVideoPreview: videosData.data?.[0] ? {
        name: videosData.data[0].name,
        description: videosData.data[0].description?.substring(0, 100) + '...',
        hasDescription: !!videosData.data[0].description
      } : null
    })
    
    // Transform videos data
    const videos = videosData.data?.map((video: any) => ({
      id: video.uri?.split('/').pop(),
      title: video.name,
      description: video.description, // Make sure description is included
      thumbnail: video.pictures?.sizes?.find((size: any) => size.width >= 200)?.link,
      duration: video.duration,
      created_time: video.created_time,
      link: video.link
    })) || []
    
    console.log('✅ Found', videos.length, 'videos in folder')
    console.log('📋 Transformed first video:', videos[0] ? {
      title: videos[0].title,
      hasDescription: !!videos[0].description,
      descriptionLength: videos[0].description?.length || 0
    } : 'No videos')
    
    return NextResponse.json({ 
      success: true, 
      videos 
    })
    
  } catch (error) {
    console.error('Error fetching folder videos:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch videos' },
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