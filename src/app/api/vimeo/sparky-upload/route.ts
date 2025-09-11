import { NextRequest, NextResponse } from 'next/server'
import { uploadToSparkyFolder } from '@/lib/vimeo-sparky'

export async function POST(request: NextRequest) {
  try {
    console.log('🎥 Video upload request received')
    
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const userMetadata = JSON.parse(formData.get('userMetadata') as string)
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }
    
    console.log('📁 Uploading to Sparky Screen Recordings folder (not creating new folder)')
    
    // Upload to main Sparky folder - NO user-specific folders
    const videoData = await uploadToSparkyFolder(videoFile, userMetadata)
    
    // Store in app database for user's "Your Recordings" panel
    // but video lives in main Sparky folder on Vimeo
    console.log('✅ Video uploaded to Sparky folder successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Video uploaded to Sparky Screen Recordings folder',
      videoData: {
        ...videoData,
        folderLocation: 'Sparky Screen Recordings', // Confirm folder location
        userAccess: userMetadata.email // For app organization
      }
    })
    
  } catch (error) {
    console.error('❌ Video upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload video to Sparky folder' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📥 Fetching videos from Sparky Screen Recordings folder')
    
    const { fetchSparkyFolderVideos } = await import('@/lib/vimeo-sparky')
    const videos = await fetchSparkyFolderVideos()
    
    return NextResponse.json({
      success: true,
      videos: videos,
      folderName: 'Sparky Screen Recordings',
      totalCount: videos.length
    })
    
  } catch (error) {
    console.error('❌ Error fetching Sparky folder videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videos from Sparky folder' },
      { status: 500 }
    )
  }
}