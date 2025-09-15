import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪🧪🧪 API TEST ROUTE CALLED 🧪🧪🧪')

  return NextResponse.json({
    success: true,
    message: 'API routes are working perfectly!',
    timestamp: new Date().toISOString(),
    data: {
      test: 'This proves API routes work',
      env: {
        hasToken: !!process.env.VIMEO_ACCESS_TOKEN,
        tokenLength: process.env.VIMEO_ACCESS_TOKEN?.length || 0
      }
    }
  })
}