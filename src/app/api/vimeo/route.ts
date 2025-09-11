import { NextRequest, NextResponse } from 'next/server'
import VimeoService from '@/lib/vimeo'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    const videoId = searchParams.get('videoId')
    const folderId = searchParams.get('folderId')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '25')

    const vimeo = new VimeoService()

    switch (action) {
      case 'test-connection':
        const userData = await vimeo.testConnection()
        return NextResponse.json({
          user: userData,
          success: true
        })

      case 'test-team':
        const userInfo = await vimeo.testConnection()
        return NextResponse.json({ success: true, user: userInfo })

      case 'list':
        const videos = await vimeo.getVideos(page, perPage)
        return NextResponse.json(videos)

      case 'get-video':
        if (!videoId) {
          return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
        }
        const video = await vimeo.getVideo(videoId)
        return NextResponse.json(video)

      case 'get-folders':
        const folders = await vimeo.getFolders()
        return NextResponse.json(folders)

      case 'get-folder':
        if (!folderId) {
          return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
        }
        const folder = await vimeo.getFolder(folderId)
        return NextResponse.json(folder)

      case 'get-folder-videos':
        if (!folderId) {
          return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
        }
        const folderVideos = await vimeo.getFolderVideos(folderId, page, perPage)
        return NextResponse.json(folderVideos)

      case 'test-move-folder':
        // Test moving folder 26555430 into SSR folder 26555277
        try {
          console.log('Testing folder move: 26555430 -> 26555277')
          const result = await vimeo.moveFolder('26555430', '26555277')
          return NextResponse.json({ 
            success: true, 
            message: 'Folder moved successfully',
            result 
          })
        } catch (error) {
          console.error('Folder move test failed:', error)
          return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Move failed',
            message: 'Failed to move test folder'
          })
        }

      case 'debug-folder-structure':
        // Debug the current folder structure
        try {
          const allFolders = await vimeo.getAllFolders()
          const ssrFolder = await vimeo.getFolder('26555277')
          const testFolder = await vimeo.getFolder('26555430')
          
          return NextResponse.json({
            allFolders: allFolders.slice(0, 10), // Just first 10 to avoid too much data
            ssrFolder,
            testFolder,
            message: 'Current folder structure'
          })
        } catch (error) {
          return NextResponse.json({
            error: error instanceof Error ? error.message : 'Debug failed',
            message: 'Failed to get folder structure'
          })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Vimeo API error (GET):', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      error: error
    })
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch data from Vimeo' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action

    console.log('POST request received with action:', action)

    const vimeo = new VimeoService()
    console.log('VimeoService initialized')

    switch (action) {
      case 'upload-ticket':
        const { fileSize, fileName, folderId, customMetadata } = body
        const ticket = await vimeo.createUploadTicket(fileSize, fileName, folderId, customMetadata)
        return NextResponse.json(ticket)

      case 'upload-ticket-user':
        console.log('Starting upload-ticket-user request')
        try {
          const { 
            userFileSize, 
            userFileName, 
            customerName, 
            customerEmail, 
            userDisplayName,
            title,
            description
          } = body
          console.log('Request data:', {
            userFileSize,
            userFileName,
            customerName,
            customerEmail,
            userDisplayName,
            title,
            description
          })

          // Hybrid folder strategy:
          // 1. Try to find existing user folder
          // 2. If not found, create user folder for this liaison
          // 3. If creation fails, fallback to main Sparky folder
          console.log('🔍 Looking for existing folder for:', userDisplayName)
          
          let targetFolderUri = '/folders/26555277' // Default to main Sparky folder
          let targetFolderName = 'Sparky Screen Recordings'
          
          try {
            // Try to create or find user-specific folder
            const userFolder = await vimeo.createUserSpecificFolder(userDisplayName, customerEmail)
            if (userFolder && userFolder.uri) {
              targetFolderUri = userFolder.uri
              targetFolderName = userFolder.name
              console.log('✅ Using user folder:', targetFolderName)
            } else {
              console.log('⚠️ User folder creation returned invalid result, using main folder')
            }
          } catch (error) {
            console.log('⚠️ User folder creation failed, using main Sparky folder:', error)
            // targetFolderUri already set to main folder
          }
          
          console.log('📁 Final folder assignment:', { targetFolderUri, targetFolderName })
          
          // Create upload ticket with determined folder
          console.log('Creating upload ticket with folder assignment...')
          const uploadTicket = await vimeo.createUploadTicket(
            userFileSize,
            userFileName,
            targetFolderUri,
            {
              title: `[${userDisplayName}] ${customerName} - Screen Recording`,
              description: `SPARKY SCREEN RECORDING
═══════════════════════════════════
👤 Customer: ${customerName}
📧 Email: ${customerEmail}
🎥 Recorded by: ${userDisplayName}
📅 Date: ${new Date().toLocaleDateString()}

${description ? `📝 Notes: ${description}` : ''}

🏷️ Tags: sparky-recording, ${userDisplayName.toLowerCase().replace(/\s+/g, '-')}, customer-${customerName.toLowerCase().replace(/\s+/g, '-')}`,
              customerName,
              customerEmail
            }
          )
          
          console.log('Upload ticket created successfully:', uploadTicket)
          
          return NextResponse.json({
            ...uploadTicket,
            folderUri: targetFolderUri,
            folderName: targetFolderName
          })
        } catch (error) {
          console.error('Error in upload-ticket-user:', error)
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
          throw error
        }

      case 'create-folder':
        const { name } = body
        const folder = await vimeo.createFolder(name)
        return NextResponse.json(folder)

      case 'create-user-folder':
        const { userDisplayName: displayName, userEmail: email } = body
        const newUserFolder = await vimeo.createUserSpecificFolder(displayName, email)
        return NextResponse.json(newUserFolder)

      case 'move-video-to-folder':
        console.log('Moving video to folder...')
        try {
          const { videoUri, folderUri } = body
          console.log('Move request:', { videoUri, folderUri })
          
          await vimeo.moveVideoToFolder(videoUri, folderUri)
          
          return NextResponse.json({ success: true })
        } catch (error) {
          console.error('Error moving video to folder:', error)
          return NextResponse.json({ error: 'Failed to move video' }, { status: 500 })
        }

      case 'delete-video':
        const { videoId } = body
        await vimeo.deleteVideo(videoId)
        return NextResponse.json({ success: true })

      case 'delete-videos':
        const { videoIds } = body
        await vimeo.deleteVideos(videoIds)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Vimeo API error (POST):', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      error: error
    })
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process request' 
    }, { status: 500 })
  }
}

// PATCH endpoint for organizing folders and debugging
export async function PATCH(request: Request) {
  try {
    const { action } = await request.json()
    
    if (action === 'organize-folders') {
      const vimeo = new VimeoService()
      await vimeo.organizeFoldersIntoSSR()
      
      return NextResponse.json({ 
        success: true,
        message: 'Folder organization completed. Check console logs for details.'
      })
    }
    
    if (action === 'move-folder') {
      const body = await request.json()
      const { sourceFolderId, targetFolderId } = body
      
      if (!sourceFolderId || !targetFolderId) {
        return NextResponse.json({ 
          error: 'Missing sourceFolderId or targetFolderId' 
        }, { status: 400 })
      }
      
      const vimeo = new VimeoService()
      
      try {
        // Try to move the folder using PATCH
        const result = await vimeo.moveFolder(sourceFolderId, targetFolderId)
        
        return NextResponse.json({ 
          success: true,
          result,
          message: `Successfully moved folder ${sourceFolderId} into ${targetFolderId}`
        })
      } catch (error) {
        return NextResponse.json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Failed to move folder',
          message: `Failed to move folder ${sourceFolderId} into ${targetFolderId}`
        }, { status: 500 })
      }
    }
    
    if (action === 'debug-folders') {
      const vimeo = new VimeoService()
      
      // Get all folders at root level
      const rootFolders = await vimeo.getAllFolders()
      
      return NextResponse.json({ 
        success: true,
        folders: rootFolders,
        message: `Found ${rootFolders.length} folders in account`
      })
    }
    
    return NextResponse.json({ 
      error: 'Unknown action' 
    }, { status: 400 })
    
  } catch (error) {
    console.error('Error in PATCH /api/vimeo:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process request' 
    }, { status: 500 })
  }
}
