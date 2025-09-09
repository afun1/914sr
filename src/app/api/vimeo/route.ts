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

          // Step 1: Create or get liaison-specific folder inside Sparky Screen Recordings
          // Note: We organize by liaison (userDisplayName) not customer, since customers may work with multiple liaisons
          console.log('Creating/getting liaison folder for:', userDisplayName)
          const userFolder = await vimeo.createUserSpecificFolder(userDisplayName, customerEmail)
          console.log('Liaison folder created/found:', userFolder.name, userFolder.uri)
          
          // Use the full folder URI for project subfolders
          const folderUri = userFolder.uri
          console.log('Using folder URI for upload:', folderUri)
          
          // Step 2: Create upload ticket WITH folder assignment
          console.log('Creating upload ticket with folder assignment...')
          const uploadTicket = await vimeo.createUploadTicket(
            userFileSize,
            userFileName,
            folderUri, // Pass the full URI instead of just the ID
            {
              title: title || `${customerName} - Screen Recording`,
              description: `Customer: ${customerName}\nEmail: ${customerEmail}\nRecorded by: ${userDisplayName}\n\n${description || 'Screen recording session'}`,
              customerName,
              customerEmail
            }
          )
          
          console.log('Upload ticket created successfully:', uploadTicket)
          
          return NextResponse.json({
            ...uploadTicket,
            folderUri: userFolder.uri,
            folderName: userFolder.name
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
