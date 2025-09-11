import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { folderName } = await request.json()
    
    console.log(`🗂️ Creating simple folder: ${folderName}`)
    
    // Create Vimeo folder
    const vimeoResponse = await fetch('https://api.vimeo.com/me/projects', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        description: `Screen recordings folder for ${folderName}`
      })
    })
    
    if (!vimeoResponse.ok) {
      const errorText = await vimeoResponse.text()
      throw new Error(`Vimeo API error: ${vimeoResponse.status} - ${errorText}`)
    }
    
    const vimeoProject = await vimeoResponse.json()
    const projectId = vimeoProject.uri.split('/').pop()
    
    console.log(`✅ Created Vimeo folder: ${vimeoProject.name} (ID: ${projectId})`)
    
    return NextResponse.json({
      success: true,
      message: `Folder "${folderName}" created successfully`,
      folderId: projectId,
      folderName: vimeoProject.name
    })
    
  } catch (error) {
    console.error('❌ Error creating folder:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to create folder'
      },
      { status: 500 }
    )
  }
}