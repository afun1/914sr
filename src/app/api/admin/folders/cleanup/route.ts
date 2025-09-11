import { NextRequest, NextResponse } from 'next/server'

export async function POST() {
  try {
    // Get all folders
    const foldersResponse = await fetch('https://api.vimeo.com/me/folders?per_page=100', {
      headers: {
        'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!foldersResponse.ok) {
      throw new Error('Failed to fetch folders')
    }

    const foldersData = await foldersResponse.json()
    const folders = foldersData.data || []

    // Group folders by name to find duplicates
    const folderGroups: { [name: string]: any[] } = {}
    
    folders.forEach((folder: any) => {
      const name = folder.name
      if (!folderGroups[name]) {
        folderGroups[name] = []
      }
      folderGroups[name].push(folder)
    })

    let mergedCount = 0

    // Process each group of duplicate folders
    for (const [folderName, duplicates] of Object.entries(folderGroups)) {
      if (duplicates.length > 1) {
        console.log(`Found ${duplicates.length} duplicates for "${folderName}"`)
        
        // Sort by creation date to keep the oldest one
        duplicates.sort((a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime())
        
        const keepFolder = duplicates[0] // Keep the oldest
        const foldersToMerge = duplicates.slice(1) // Merge the rest
        
        const keepFolderId = keepFolder.uri.split('/').pop()
        
        // Move all videos from duplicate folders to the one we're keeping
        for (const folder of foldersToMerge) {
          const folderId = folder.uri.split('/').pop()
          
          try {
            // Get videos in this folder
            const videosResponse = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos`, {
              headers: {
                'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (videosResponse.ok) {
              const videosData = await videosResponse.json()
              const videos = videosData.data || []
              
              // Move each video to the folder we're keeping
              for (const video of videos) {
                const videoId = video.uri.split('/').pop()
                
                try {
                  // Add to keep folder
                  await fetch(`https://api.vimeo.com/me/folders/${keepFolderId}/videos/${videoId}`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                      'Content-Type': 'application/json'
                    }
                  })
                  
                  // Remove from source folder
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
            
            // Delete the duplicate folder
            await fetch(`https://api.vimeo.com/me/folders/${folderId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            })
            
            mergedCount++
            
          } catch (error) {
            console.error(`Failed to process duplicate folder ${folder.name}:`, error)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${mergedCount} duplicate folders`
    })

  } catch (error) {
    console.error('Failed to cleanup duplicates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup duplicates' },
      { status: 500 }
    )
  }
}
