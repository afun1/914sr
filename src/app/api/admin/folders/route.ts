import { NextRequest, NextResponse } from 'next/server'
import { VimeoService } from '@/lib/vimeo'

const vimeoService = new VimeoService()

export async function GET() {
  try {
    // Get all folders from Vimeo
    const response = await fetch('https://api.vimeo.com/me/folders?per_page=100', {
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
    const folders = data.data || []

    // Get video counts for each folder
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder: any) => {
        try {
          const folderId = folder.uri.split('/').pop()
          const videosResponse = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos?per_page=1`, {
            headers: {
              'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (videosResponse.ok) {
            const videosData = await videosResponse.json()
            return {
              ...folder,
              videoCount: videosData.total || 0
            }
          }
        } catch (error) {
          console.error(`Failed to get video count for folder ${folder.name}:`, error)
        }
        
        return {
          ...folder,
          videoCount: 0
        }
      })
    )

    return NextResponse.json({
      success: true,
      folders: foldersWithCounts
    })

  } catch (error) {
    console.error('Failed to fetch folders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { folderUri } = await request.json()
    
    if (!folderUri) {
      return NextResponse.json(
        { success: false, error: 'Folder URI is required' },
        { status: 400 }
      )
    }

    const folderId = folderUri.split('/').pop()
    
    const response = await fetch(`https://api.vimeo.com/me/folders/${folderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to delete folder: ${response.status} ${response.statusText}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete folder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
