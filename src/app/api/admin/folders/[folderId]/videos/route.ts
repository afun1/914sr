import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  try {
    const { folderId } = params

    // Get videos from the specific folder
    const response = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })

    if (!response.ok) {
      throw new Error(`Vimeo API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const videos = data.data || []

    // Format video data for frontend consumption
    const formattedVideos = videos.map((video: any) => ({
      uri: video.uri,
      name: video.name,
      description: video.description,
      created_time: video.created_time,
      modified_time: video.modified_time,
      duration: video.duration,
      width: video.width,
      height: video.height,
      link: video.link,
      player_embed_url: video.player_embed_url,
      pictures: video.pictures
    }))

    return NextResponse.json({
      success: true,
      videos: formattedVideos,
      total: data.total || formattedVideos.length
    })

  } catch (error) {
    console.error('Failed to fetch folder videos:', error)
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
