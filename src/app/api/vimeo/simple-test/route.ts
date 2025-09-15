// filepath: c:\sr97\src\app\api\vimeo\simple-test\route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 SIMPLE TEST API - Checking if routes work')

  return NextResponse.json({
    success: true,
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
    testData: {
      folders: [{
        name: 'Test Folder',
        videos: [{
          name: 'Test Video',
          description: 'Test description'
        }]
      }]
    }
  })
}