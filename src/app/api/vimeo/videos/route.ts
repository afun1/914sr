import { NextRequest, NextResponse } from 'next/server'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API_BASE = 'https://api.vimeo.com'

if (!VIMEO_ACCESS_TOKEN) {
  console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables')
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔥 Vimeo videos API called')
    
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    // Get all videos from Vimeo
    const response = await fetch(`${VIMEO_API_BASE}/me/videos?per_page=100&fields=uri,name,description,duration,created_time,pictures.sizes`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Vimeo API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch videos from Vimeo' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('🎥 Raw videos from Vimeo:', data.data?.length || 0)

    return NextResponse.json({
      videos: data.data || [],
      total: data.data?.length || 0,
      paging: data.paging
    })
  } catch (error) {
    console.error('❌ Error in videos API:', error)
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
        { error: 'Video ID is required for deletion' },
        { status: 400 }
      )
    }

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    console.log('🗑️ Deleting Vimeo video with ID:', deleteId)

    // Delete video from Vimeo
    const response = await fetch(`${VIMEO_API_BASE}/videos/${deleteId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Vimeo video deletion failed:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Error details:', errorText)
      
      return NextResponse.json(
        { error: `Failed to delete video from Vimeo: ${response.statusText}` },
        { status: response.status }
      )
    }

    console.log('✅ Video deleted successfully from Vimeo')

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error in video deletion API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}