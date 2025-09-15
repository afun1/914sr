import { NextRequest } from 'next/server'
import { fetchFolders } from './route.gpt'

export async function GET(request: NextRequest) {
  return await fetchFolders(request)
}

// Simple test to check if API is working
export async function testAPI(request: NextRequest) {
  console.log('🧪 SIMPLE TEST: API is working!')

  return NextResponse.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    folders: [
      {
        uri: '/projects/test',
        name: 'Test Folder',
        created_time: new Date().toISOString(),
        videos: [
          {
            uri: '/videos/test',
            name: 'Test Video',
            description: 'Test description',
            duration: 60,
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