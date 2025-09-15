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

    // Get user email from query params for filtering
    const { searchParams } = new URL(request.url)
    const requestedUserEmail = searchParams.get('user')

    if (!requestedUserEmail) {
      console.error('❌ No user email provided in API request')
      return NextResponse.json({ error: 'User email required' }, { status: 400 })
    }

    console.log('✅ API called for user:', requestedUserEmail)

    // Get folders from Vimeo
    const response = await fetch(`${VIMEO_API_BASE}/me/projects?per_page=100&fields=uri,name,created_time,modified_time`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ Failed to fetch Vimeo folders:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Vimeo API error:', errorText)
      return NextResponse.json({ error: 'Failed to fetch folders from Vimeo' }, { status: 500 })
    }

    const data = await response.json()
    console.log('📊 Raw folders from Vimeo:', data.data?.length || 0)

    // Get all videos from Vimeo for filtering
    const videosResponse = await fetch(`${VIMEO_API_BASE}/me/videos?per_page=100&fields=uri,name,description,duration,created_time,pictures.sizes`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!videosResponse.ok) {
      console.error('❌ Failed to fetch Vimeo videos:', videosResponse.status, videosResponse.statusText)
      return NextResponse.json({ error: 'Failed to fetch videos from Vimeo' }, { status: 500 })
    }

    const videosData = await videosResponse.json()
    console.log('🎥 Raw videos from Vimeo:', videosData.data?.length || 0)

    const allVideos = videosData.data || []
    const allFolders = data.data || []

    // Simple response for now - return all folders with all videos
    return NextResponse.json({
      folders: allFolders.map((folder: any) => ({
        ...folder,
        videos: allVideos // Include all videos in each folder for now
      })),
      totalFolders: allFolders.length,
      totalVideos: allVideos.length
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
    const response = await fetch(`${VIMEO_API_BASE}/projects/${deleteId}`, {
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