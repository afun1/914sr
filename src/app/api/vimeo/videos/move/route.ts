// filepath: c:\sr97\src\app\api\vimeo\videos\move\route.ts
import { NextRequest, NextResponse } from 'next/server'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN

export async function POST(request: NextRequest) {
  try {
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { videoUri, userEmail } = body

    if (!videoUri || !userEmail) {
      return NextResponse.json(
        { error: 'videoUri and userEmail are required' },
        { status: 400 }
      )
    }

    console.log('📹 Moving video to user folder:', videoUri, 'for user:', userEmail)

    // First, ensure user folder exists
    const userFolderName = `User: ${userEmail}`

    // Get existing folders to find or create user folder
    const foldersResponse = await fetch('https://api.vimeo.com/me/projects', {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!foldersResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch folders' },
        { status: 500 }
      )
    }

    const foldersData = await foldersResponse.json()
    let userFolder = foldersData.data.find((f: any) => f.name === userFolderName)

    // Create folder if it doesn't exist
    if (!userFolder) {
      const createResponse = await fetch('https://api.vimeo.com/me/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userFolderName,
          privacy: {
            view: 'anybody'
          }
        }),
      })

      if (!createResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to create user folder' },
          { status: 500 }
        )
      }

      const newFolder = await createResponse.json()
      userFolder = newFolder
    }

    // Move video to user folder
    const videoId = videoUri.split('/').pop()
    const folderId = userFolder.uri.split('/').pop()

    const moveResponse = await fetch(`https://api.vimeo.com/videos/${videoId}/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      }
    })

    if (!moveResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to move video to folder' },
        { status: 500 }
      )
    }

    console.log('✅ Video moved to user folder successfully')
    return NextResponse.json({
      success: true,
      message: 'Video moved to user folder successfully'
    })
  } catch (error) {
    console.error('❌ Error moving video:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}