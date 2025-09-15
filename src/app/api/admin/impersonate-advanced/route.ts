import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize both clients
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
    console.log('🎭 ADVANCED Impersonation API called')
    
    // Get token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No valid authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔑 Token received, verifying...')

    // Verify the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('❌ Token verification failed:', userError)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    console.log('✅ Token verified for user:', user.email)

    // Check admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('🚫 Access denied - user role:', profile?.role)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get target user info
    const body = await request.json()
    const { targetUserId, targetUserEmail } = body

    if (!targetUserId || !targetUserEmail) {
      return NextResponse.json({ error: 'Missing target user information' }, { status: 400 })
    }

    console.log('🎭 Creating direct session for:', targetUserEmail)

    // SUPER DANGEROUS: Create a session token directly for the user
    const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.createUser({
      email: targetUserEmail,
      email_confirm: true,
      user_metadata: {
        impersonated_by: user.id,
        impersonated_at: new Date().toISOString()
      }
    })

    if (tokenError) {
      console.error('❌ Failed to create user session:', tokenError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Generate a session for this user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserEmail
    })

    if (sessionError) {
      console.error('❌ Failed to generate session link:', sessionError)
      return NextResponse.json({ error: 'Failed to generate session' }, { status: 500 })
    }

    // Determine redirect URL
    const origin = request.headers.get('origin') || 'http://localhost:3000'
    const redirectUrl = process.env.NODE_ENV === 'development' ? origin : 'https://97sr.vercel.app'

    // Create custom magic link with correct redirect
    const magicLink = sessionData.properties?.action_link
    if (magicLink) {
      const url = new URL(magicLink)
      url.searchParams.set('redirect_to', `${redirectUrl}/users`)
      
      // Log security event
      console.log('🔒 SECURITY: Advanced impersonation', {
        admin: user.email,
        target: targetUserEmail,
        redirect: redirectUrl,
        timestamp: new Date().toISOString()
      })

      return NextResponse.json({
        success: true,
        message: 'Advanced impersonation session created',
        impersonationLink: url.toString(),
        redirectUrl
      })
    }

    return NextResponse.json({ error: 'Failed to create magic link' }, { status: 500 })

  } catch (error) {
    console.error('❌ Advanced impersonation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}