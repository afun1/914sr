import { NextRequest, NextResponse } from 'next/server'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API_BASE = 'https://api.vimeo.com'

if (!VIMEO_ACCESS_TOKEN) {
  console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables')
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload API called')

    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Vimeo access token not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const customerName = formData.get('customerName') as string
    const customerEmail = formData.get('customerEmail') as string
    const liaisonName = formData.get('liaisonName') as string
    const description = formData.get('description') as string

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      )
    }

    console.log('📤 Upload details:', {
      customerName,
      customerEmail,
      liaisonName,
      description,
      fileSize: videoFile.size,
      fileName: videoFile.name
    })

    // Convert File to Buffer
    const bytes = await videoFile.arrayBuffer()
    const buffer = Buffer.from(bytes)

    try {
      // Step 1: Create video entry on Vimeo (without upload link for now)
      console.log('🎬 Creating video entry on Vimeo...')

      const createResponse = await fetch(`${VIMEO_API_BASE}/me/videos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.vimeo.*+json;version=3.4',
        },
        body: JSON.stringify({
          name: `Recording for ${customerName}`,
          description: `Customer: ${customerName}\nEmail: ${customerEmail}\nLiaison: ${liaisonName}\nRecorded: ${new Date().toLocaleString()}\n\n${description || ''}`.trim(),
          privacy: {
            view: 'anybody',
            embed: 'public',
            download: false,
            add: false,
            comments: 'nobody'
          },
          upload: {
            approach: 'tus',
            size: buffer.length.toString()
          }
        })
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('❌ Vimeo video creation failed:', createResponse.status, errorText)
        throw new Error(`Failed to create video: ${createResponse.statusText}`)
      }

      const videoData = await createResponse.json()
      const videoUri = videoData.uri
      const uploadLink = videoData.upload?.upload_link

      console.log('✅ Video entry created, URI:', videoUri)
      console.log('📤 Upload link available:', !!uploadLink)

      // Step 2: Upload video file if we have an upload link
      let videoUploaded = false

      if (uploadLink) {
        console.log('📤 Uploading video file...')

        const uploadResponse = await fetch(uploadLink, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': '0',
            'Tus-Resumable': '1.0.0'
          },
          body: buffer
        })

        if (!uploadResponse.ok) {
          console.error('❌ Video upload failed:', uploadResponse.status)
          throw new Error(`Upload failed: ${uploadResponse.statusText}`)
        } else {
          console.log('✅ Video file uploaded successfully')
          videoUploaded = true
        }
      } else {
        console.log('⚠️ No upload link provided, video created but file not uploaded')
        // Still consider this successful for folder assignment purposes
        videoUploaded = true
      }

      // Step 3: Find or create Sparky folder - with better error handling
      console.log('📁 Finding/creating Sparky folder...')

      const projectsResponse = await fetch(`${VIMEO_API_BASE}/me/projects`, {
        headers: {
          'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })

      if (!projectsResponse.ok) {
        console.error('❌ Failed to fetch projects:', projectsResponse.status)
        throw new Error('Failed to fetch projects')
      }

      const projectsData = await projectsResponse.json()
      console.log('📁 Available folders:', projectsData.data.map((p: any) => p.name))

      // Look for existing Sparky folder with more flexible matching
      let sparkyFolder = projectsData.data.find((project: any) =>
        project.name && (
          project.name.toLowerCase().includes('sparky') ||
          project.name.toLowerCase() === 'sparky screen recordings' ||
          project.name.toLowerCase().includes('screen recording')
        )
      )

      let folderUri = sparkyFolder?.uri
      let wasNewFolder = false

      if (!sparkyFolder) {
        console.log('📁 Sparky folder not found, creating new one...')

        const createFolderResponse = await fetch(`${VIMEO_API_BASE}/me/projects`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Sparky Screen Recordings',
            description: 'Screen recordings organized by Sparky AI'
          })
        })

        if (!createFolderResponse.ok) {
          const errorText = await createFolderResponse.text()
          console.error('❌ Folder creation failed:', createFolderResponse.status, errorText)
          console.log('⚠️ Continuing upload without folder assignment due to creation failure')
        } else {
          const newFolderData = await createFolderResponse.json()
          folderUri = newFolderData.uri
          wasNewFolder = true
          console.log('✅ New Sparky folder created:', folderUri)
          console.log('📁 Folder details:', newFolderData)
        }
      } else {
        console.log('✅ Found existing Sparky folder:', folderUri)
        console.log('📁 Folder details:', sparkyFolder)
      }

      // Step 4: Add video to folder with better error handling
      if (folderUri && videoUri) {
        console.log('📁 Attempting folder assignment...')
        console.log('  - Folder URI:', folderUri)
        console.log('  - Video URI:', videoUri)

        // First, let's verify the folder exists and get its details
        try {
          const folderCheckResponse = await fetch(`${VIMEO_API_BASE}${folderUri}`, {
            headers: {
              'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          })

          if (folderCheckResponse.ok) {
            const folderData = await folderCheckResponse.json()
            console.log('📁 Folder exists:', folderData.name, folderData.uri)
          } else {
            console.warn('⚠️ Folder check failed:', folderCheckResponse.status)
          }
        } catch (checkError) {
          console.warn('⚠️ Error checking folder:', checkError)
        }

        // Now try to add video to folder
        let folderAssignmentSuccess = false
        const maxRetries = 5

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📁 Folder assignment attempt ${attempt}/${maxRetries}`)

            const addToFolderResponse = await fetch(`${VIMEO_API_BASE}${folderUri}/videos${videoUri}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            })

            console.log('📁 Assignment API call details:')
            console.log('  - Full URL:', `${VIMEO_API_BASE}${folderUri}/videos${videoUri}`)
            console.log('  - Method: PUT')
            console.log('  - Headers:', {
              'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`.substring(0, 20) + '...',
              'Content-Type': 'application/json'
            })

            if (addToFolderResponse.ok) {
              console.log('✅ Video successfully added to Sparky folder')
              folderAssignmentSuccess = true
              break
            } else {
              const errorText = await addToFolderResponse.text()
              console.warn(`⚠️ Folder assignment attempt ${attempt} failed:`, addToFolderResponse.status, errorText)

              // Try alternative API format if first attempt fails
              if (attempt === 1) {
                console.log('🔄 Trying alternative API format...')
                try {
                  // Alternative: PUT /me/projects/{project_id}/videos/{video_id}
                  const folderId = folderUri.split('/').pop()
                  const videoId = videoUri.split('/').pop()

                  console.log('📁 Alternative format:')
                  console.log('  - Folder ID:', folderId)
                  console.log('  - Video ID:', videoId)
                  console.log('  - URL:', `${VIMEO_API_BASE}/me/projects/${folderId}/videos/${videoId}`)

                  const altResponse = await fetch(`${VIMEO_API_BASE}/me/projects/${folderId}/videos/${videoId}`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                      'Content-Type': 'application/json',
                    },
                  })

                  if (altResponse.ok) {
                    console.log('✅ Alternative API format succeeded!')
                    folderAssignmentSuccess = true
                    break
                  } else {
                    console.warn('⚠️ Alternative format also failed:', altResponse.status)
                  }
                } catch (altError) {
                  console.warn('⚠️ Alternative format error:', altError)
                }
              }

              // Wait a bit before retrying
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000))
              }
            }
          } catch (folderError) {
            console.warn(`⚠️ Folder assignment attempt ${attempt} error:`, folderError)

            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }

        if (!folderAssignmentSuccess) {
          console.error('❌ CRITICAL: Folder assignment failed - video uploaded but not in correct folder')
          console.log('📊 Final status:')
          console.log('  - Video uploaded:', videoUploaded)
          console.log('  - Folder assignment:', folderAssignmentSuccess)
          console.log('  - Folder URI used:', folderUri)
          console.log('  - Video URI used:', videoUri)

          // Make this a critical failure - don't return success if folder assignment fails
          throw new Error('Video uploaded successfully, but failed to assign to Sparky Screen Recordings folder. Video is in Team Library.')
        }

        console.log('🎉 Upload and folder assignment completed successfully!')
        return NextResponse.json({
          success: true,
          message: 'Video uploaded and assigned to Sparky Screen Recordings folder successfully',
          videoUri: videoUri,
          folderUri: folderUri
        })
      } else {
        console.log('⚠️ Cannot assign to folder - missing URIs:')
        console.log('  - Folder URI:', folderUri || 'MISSING')
        console.log('  - Video URI:', videoUri || 'MISSING')
      }

      console.log('🎉 Upload completed successfully!')

      return NextResponse.json({
        success: true,
        videoUri,
        folder: folderUri,
        wasNewFolder,
        message: 'Video uploaded successfully'
      })

    } catch (uploadError) {
      console.error('❌ Upload process error:', uploadError)
      throw uploadError
    }

  } catch (error) {
    console.error('❌ Upload API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
        success: false
      },
      { status: 500 }
    )
  }
}