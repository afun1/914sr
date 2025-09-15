import { NextResponse } from 'next/server'

// This endpoint manages Vimeo folders/projects
export async function GET() {
  try {
    console.log('📁 Fetching folders from Vimeo...')
    
    const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vimeo access token not configured',
        folders: []
      }, { status: 500 })
    }

    // Fetch folders/projects from Vimeo (same as your customers API)
    const foldersResponse = await fetch('https://api.vimeo.com/me/projects', {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })

    if (!foldersResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch folders from Vimeo',
        folders: []
      }, { status: foldersResponse.status })
    }

    const foldersData = await foldersResponse.json()
    
    // Get video counts for each folder
    const foldersWithCounts = await Promise.all(
      (foldersData.data || []).map(async (folder: any) => {
        let videoCount = 0
        try {
          const videosResponse = await fetch(`https://api.vimeo.com/me/projects/${folder.uri.split('/').pop()}/videos`, {
            headers: {
              'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
              'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
          })
          
          if (videosResponse.ok) {
            const videosData = await videosResponse.json()
            videoCount = videosData.data?.length || 0
          }
        } catch (error) {
          console.log(`Error counting videos in folder ${folder.name}:`, error)
        }

        return {
          ...folder,
          video_count: videoCount
        }
      })
    )

    console.log(`✅ Fetched ${foldersWithCounts.length} folders from Vimeo`)
    
    return NextResponse.json({
      success: true,
      folders: foldersWithCounts
    })

  } catch (error) {
    console.error('Error fetching folders:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch folders',
      folders: []
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log('📁 Creating new folder in Vimeo...')
    
    const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vimeo access token not configured'
      }, { status: 500 })
    }

    const { name, description } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Folder name is required'
      }, { status: 400 })
    }

    // Create folder/project in Vimeo
    const createResponse = await fetch('https://api.vimeo.com/me/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description?.trim() || ''
      })
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}))
      return NextResponse.json({ 
        success: false, 
        error: errorData.error || 'Failed to create folder in Vimeo'
      }, { status: createResponse.status })
    }

    const newFolder = await createResponse.json()
    
    console.log(`✅ Created folder: ${newFolder.name}`)
    
    return NextResponse.json({
      success: true,
      ...newFolder,
      video_count: 0
    })

  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create folder'
    }, { status: 500 })
  }
}