import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const envCheck = {
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    console.log('🔧 Environment check:', envCheck)

    return NextResponse.json({
      message: 'Environment check',
      env: envCheck,
      missingKeys: Object.entries(envCheck)
        .filter(([key, exists]) => !exists)
        .map(([key]) => key)
    })

  } catch (error) {
    console.error('❌ Debug error:', error)
    return NextResponse.json({ 
      error: 'Debug error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}