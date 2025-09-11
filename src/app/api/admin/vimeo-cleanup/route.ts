import { NextRequest, NextResponse } from 'next/server'

const SPARKY_FOLDER_ID = '26555277' // Main Sparky Screen Recorder folder

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (!['analyze', 'organize', 'cleanup'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const accessToken = process.env.VIMEO_ACCESS_TOKEN
    
    // Get all videos from the account
    const videosResponse = await fetch('https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,description,created_time,folder', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!videosResponse.ok) {
      throw new Error('Failed to fetch videos')
    }

    const videosData = await videosResponse.json()
    const allVideos = videosData.data || []

    // Get all folders
    const foldersResponse = await fetch('https://api.vimeo.com/me/folders?per_page=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!foldersResponse.ok) {
      throw new Error('Failed to fetch folders')
    }

    const foldersData = await foldersResponse.json()
    const allFolders = foldersData.data || []

    let stats = {
      totalVideos: allVideos.length,
      totalFolders: allFolders.length,
      videosProcessed: 0,
      foldersDeleted: 0
    }

    let details: string[] = []
    let recommendations: string[] = []

    if (action === 'analyze') {
      // ANALYZE MODE - Just report, don't change anything
      
      // Count videos in different locations
      let videosInMainFolder = 0
      let videosInLiaisonFolders = 0
      let videosInOtherFolders = 0
      let videosWithoutFolder = 0
      
      for (const video of allVideos) {
        const videoId = video.uri.split('/').pop()
        
        // Check which folders this video is in
        let inMainFolder = false
        let inLiaisonFolder = false
        let inOtherFolder = false
        
        for (const folder of allFolders) {
          const folderId = folder.uri.split('/').pop()
          
          try {
            const folderVideosResponse = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos?per_page=1&fields=uri`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (folderVideosResponse.ok) {
              const folderVideosData = await folderVideosResponse.json()
              const videoInFolder = folderVideosData.data?.some((v: any) => v.uri === video.uri)
              
              if (videoInFolder) {
                if (folderId === SPARKY_FOLDER_ID) {
                  inMainFolder = true
                } else if (folder.name.includes('/') || folder.name.includes('John') || folder.name.includes('User')) {
                  inLiaisonFolder = true
                } else {
                  inOtherFolder = true
                }
              }
            }
          } catch (error) {
            console.error(`Error checking video ${videoId} in folder ${folderId}:`, error)
          }
        }
        
        if (inMainFolder) videosInMainFolder++
        else if (inLiaisonFolder) videosInLiaisonFolders++
        else if (inOtherFolder) videosInOtherFolders++
        else videosWithoutFolder++
      }

      details.push(`Found ${allVideos.length} total videos`)
      details.push(`Found ${allFolders.length} total folders`)
      details.push(`Videos in main Sparky folder: ${videosInMainFolder}`)
      details.push(`Videos in liaison folders: ${videosInLiaisonFolders}`)
      details.push(`Videos in other folders: ${videosInOtherFolders}`)
      details.push(`Videos without folders: ${videosWithoutFolder}`)

      // Find duplicate folders
      const folderNames = allFolders.map((f: any) => f.name)
      const duplicates = folderNames.filter((name: string, index: number) => 
        folderNames.indexOf(name) !== index
      )
      
      if (duplicates.length > 0) {
        details.push(`Found ${new Set(duplicates).size} sets of duplicate folders`)
        recommendations.push('Run folder cleanup to merge duplicate folders')
      }

      if (videosInOtherFolders > 0) {
        recommendations.push(`Consider organizing ${videosInOtherFolders} videos from miscellaneous folders`)
      }

      if (videosWithoutFolder > 0) {
        recommendations.push(`${videosWithoutFolder} videos are not in any folder and could be organized`)
      }

    } else if (action === 'organize') {
      // ORGANIZE MODE - Move videos to appropriate liaison folders
      
      details.push('Starting video organization...')
      
      for (const video of allVideos) {
        const videoId = video.uri.split('/').pop()
        
        // Try to determine which user this video belongs to from description
        let targetUser = null
        if (video.description) {
          const descLines = video.description.split('\n')
          const recordedByLine = descLines.find((line: string) => line.includes('Recorded by:'))
          if (recordedByLine) {
            targetUser = recordedByLine.replace('Recorded by:', '').trim()
          }
        }
        
        if (targetUser) {
          // Find or create liaison folder for this user
          let userFolder = allFolders.find((f: any) => 
            f.name === targetUser || f.name.includes(`/${targetUser}`)
          )
          
          if (!userFolder) {
            // Create folder for this user
            try {
              const createResponse = await fetch('https://api.vimeo.com/me/folders', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: `Sparky Screen Recordings/${targetUser}`,
                  description: `Videos recorded by ${targetUser}`
                })
              })
              
              if (createResponse.ok) {
                userFolder = await createResponse.json()
                details.push(`Created new folder for ${targetUser}`)
              }
            } catch (error) {
              console.error(`Failed to create folder for ${targetUser}:`, error)
            }
          }
          
          if (userFolder) {
            const userFolderId = userFolder.uri.split('/').pop()
            
            try {
              // Move video to user folder
              await fetch(`https://api.vimeo.com/me/folders/${userFolderId}/videos/${videoId}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              })
              
              stats.videosProcessed++
              details.push(`Moved "${video.name}" to ${targetUser}'s folder`)
            } catch (error) {
              console.error(`Failed to move video ${videoId}:`, error)
            }
          }
        }
      }

    } else if (action === 'cleanup') {
      // CLEANUP MODE - Move ALL videos to main Sparky folder
      
      details.push('Starting full cleanup - moving all videos to main Sparky folder...')
      
      for (const video of allVideos) {
        const videoId = video.uri.split('/').pop()
        
        try {
          // Move video to main Sparky folder
          await fetch(`https://api.vimeo.com/me/folders/${SPARKY_FOLDER_ID}/videos/${videoId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          })
          
          stats.videosProcessed++
          details.push(`Moved "${video.name}" to main Sparky folder`)
        } catch (error) {
          console.error(`Failed to move video ${videoId}:`, error)
          details.push(`Failed to move "${video.name}"`)
        }
      }
      
      // Delete empty folders (except main Sparky folder)
      details.push('Cleaning up empty folders...')
      
      for (const folder of allFolders) {
        const folderId = folder.uri.split('/').pop()
        
        // Skip the main Sparky folder
        if (folderId === SPARKY_FOLDER_ID) continue
        
        try {
          // Check if folder is empty
          const folderVideosResponse = await fetch(`https://api.vimeo.com/me/folders/${folderId}/videos?per_page=1`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (folderVideosResponse.ok) {
            const folderVideosData = await folderVideosResponse.json()
            
            if (!folderVideosData.data || folderVideosData.data.length === 0) {
              // Folder is empty, delete it
              await fetch(`https://api.vimeo.com/me/folders/${folderId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              })
              
              stats.foldersDeleted++
              details.push(`Deleted empty folder: ${folder.name}`)
            }
          }
        } catch (error) {
          console.error(`Failed to process folder ${folderId}:`, error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      action,
      stats,
      details,
      recommendations
    })

  } catch (error) {
    console.error('Vimeo cleanup operation failed:', error)
    return NextResponse.json(
      { success: false, error: 'Cleanup operation failed' },
      { status: 500 }
    )
  }
}
