import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Profile fix utility started')
    
    // Get token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No auth header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 })
    }

    console.log('👤 Creating/fixing profile for:', user.email)

    // Try to create or update the profile
    const { data: profile, error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        role: 'admin', // Set as admin for testing
        full_name: user.email?.split('@')[0] || 'Admin User',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (upsertError) {
      console.error('❌ Profile upsert failed:', upsertError)
      return NextResponse.json({ 
        error: 'Failed to create profile',
        details: upsertError.message 
      }, { status: 500 })
    }

    console.log('✅ Profile created/updated:', profile)

    return NextResponse.json({
      success: true,
      message: 'Profile created/updated successfully',
      profile: profile
    })

  } catch (error) {
    console.error('❌ Profile fix error:', error)
    return NextResponse.json({ 
      error: 'Fix failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}