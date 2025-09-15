import { NextRequest, NextResponse } from 'next/server'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API_BASE = 'https://api.vimeo.com'

if (!VIMEO_ACCESS_TOKEN) {
  console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables')
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔥 Vimeo folder creation API called')

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { name, userId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    console.log('📁 Creating Vimeo folder:', name, 'for user:', userId)

    // Create folder on Vimeo
    const response = await fetch(`${VIMEO_API_BASE}/me/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        privacy: {
          view: 'anybody'
        }
      }),
    })

    if (!response.ok) {
      console.error('❌ Vimeo folder creation failed:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Error details:', errorText)

      return NextResponse.json(
        { error: `Failed to create folder on Vimeo: ${response.statusText}` },
        { status: response.status }
      )
    }

    const folderData = await response.json()
    console.log('✅ Folder created successfully on Vimeo:', folderData.uri)

    return NextResponse.json({
      success: true,
      folder: folderData,
      message: 'Folder created successfully'
    })
  } catch (error) {
    console.error('❌ Error in folder creation API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}