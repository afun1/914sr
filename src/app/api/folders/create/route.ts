import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { folderName } = await request.json()
    
    if (!folderName) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Create folder in Vimeo
    const vimeoResponse = await fetch('https://api.vimeo.com/me/projects', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      },
      body: JSON.stringify({
        name: folderName,
        description: `Screen recordings folder for ${folderName}`
      })
    })

    if (!vimeoResponse.ok) {
      const errorText = await vimeoResponse.text()
      console.error('Vimeo API error:', vimeoResponse.status, errorText)
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to create Vimeo folder: ${vimeoResponse.statusText}` 
        },
        { status: vimeoResponse.status }
      )
    }

    const folderData = await vimeoResponse.json()
    
    return NextResponse.json({
      success: true,
      folder: folderData,
      message: `Folder "${folderName}" created successfully`
    })

  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create folder'
      },
      { status: 500 }
    )
  }
}