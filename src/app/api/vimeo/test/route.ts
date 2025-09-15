// filepath: c:\sr97\src\app\api\vimeo\test\route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪🧪🧪 TEST API CALLED - NEW FILE 🧪🧪🧪')

  return NextResponse.json({
    success: true,
    message: 'New test API is working!',
    timestamp: new Date().toISOString(),
    folders: [
      {
        uri: '/projects/test-new',
        name: 'New Test Folder',
        created_time: new Date().toISOString(),
        videos: [
          {
            uri: '/videos/test-new',
            name: 'New Test Video',
            description: 'This is a new test video',
            duration: 120,
            created_time: new Date().toISOString(),
            pictures: {
              sizes: [
                { width: 320, height: 180, link: 'https://via.placeholder.com/320x180' }
              ]
            }
          }
        ]
      }
    ],
    totalFolders: 1,
    foldersWithVideos: 1
  })
}