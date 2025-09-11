import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { targetFolder, foldersToMerge } = await request.json()
    
    if (!targetFolder || !foldersToMerge || foldersToMerge.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Target folder and folders to merge are required' },
        { status: 400 }
      )
    }

    const targetFolderId = targetFolder.split('/').pop()
    
    // Move all videos from folders to merge into the target folder
    for (const folderUri of foldersToMerge) {
      const folderId = folderUri.split('/').pop()
      
      // Get videos in the folder
      const videosResponse = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos`, {
        headers: {
          'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (videosResponse.ok) {
        const videosData = await videosResponse.json()
        const videos = videosData.data || []
        
        // Move each video to target folder
        for (const video of videos) {
          const videoId = video.uri.split('/').pop()
          
          try {
            // Add video to target folder
            await fetch(`https://api.vimeo.com/me/folders/${targetFolderId}/videos/${videoId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            })
            
            // Remove video from source folder
            await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos/${videoId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            })
          } catch (error) {
            console.error(`Failed to move video ${videoId}:`, error)
          }
        }
      }
      
      // Delete the empty folder
      try {
        await fetch(`https://api.vimeo.com/me/folders/${folderId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        })
      } catch (error) {
        console.error(`Failed to delete folder ${folderId}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${foldersToMerge.length} folders`
    })

  } catch (error) {
    console.error('Failed to merge folders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to merge folders' },
      { status: 500 }
    )
  }
}
