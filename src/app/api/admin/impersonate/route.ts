import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase admin client (with service role key for admin operations)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This requires the service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Initialize regular Supabase client for token verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🎭 Impersonation API called')
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No valid authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔑 Token received, verifying...')

    // Verify the current user using the regular Supabase client
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('❌ Token verification failed:', userError)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    console.log('✅ Token verified for user:', user.email)

    // Check if user has admin role using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('❌ Profile lookup failed:', profileError)
      console.error('Profile error details:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      })
      
      // Try a different approach - check if the profile exists at all
      const { data: allProfiles, error: allProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .limit(5)
      
      console.log('🔍 Sample profiles check:', allProfiles, allProfilesError)
      
      return NextResponse.json({ 
        error: 'Failed to verify user role',
        details: profileError.message,
        debug: {
          userId: user.id,
          profileError: profileError.message,
          sampleProfilesCount: allProfiles?.length || 0
        }
      }, { status: 500 })
    }

    if (!profile || profile.role !== 'admin') {
      console.log('🚫 Access denied - user role:', profile?.role)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('✅ Admin role verified')

    // Get the target user info from request
    const body = await request.json()
    const { targetUserId, targetUserEmail } = body

    if (!targetUserId || !targetUserEmail) {
      return NextResponse.json({ error: 'Missing target user information' }, { status: 400 })
    }

    console.log('🎭 Admin verified, impersonating:', targetUserEmail)

    // **DANGER ZONE**: Create a new session for the target user
    // This is the risky part - we're creating auth tokens for another user
    
    // Determine the redirect URL based on environment
    let baseUrl: string
    
    if (process.env.NODE_ENV === 'development') {
      // In development, use the request origin to get the correct localhost port
      const origin = request.headers.get('origin') || 'http://localhost:3000'
      baseUrl = origin
    } else {
      // In production, use the configured site URL
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://97sr.vercel.app'
    }
    
    console.log('🔗 Using redirect URL:', baseUrl)
    
    // Generate an access token for the target user with custom redirect
    const { data: impersonationData, error: impersonationError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserEmail
      // Don't set redirect_to here, let the client handle it
    })

    if (impersonationError) {
      console.error('❌ Failed to generate impersonation link:', impersonationError)
      
      // Try alternative approach using invite link
      console.log('🔄 Trying alternative approach...')
      const { data: altData, error: altError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: targetUserEmail,
        options: {
          redirectTo: `${baseUrl}/users`
        }
      })
      
      if (altError) {
        console.error('❌ Alternative approach also failed:', altError)
        return NextResponse.json({ error: 'Failed to generate impersonation session' }, { status: 500 })
      }
      
      // Use the alternative data
      console.log('✅ Alternative approach succeeded')
      
      return NextResponse.json({
        success: true,
        message: 'Impersonation session created (alternative method)',
        impersonationLink: altData.properties?.action_link,
        targetUser: {
          id: targetUserId,
          email: targetUserEmail
        }
      })
    }

    // Log the impersonation event for security audit
    console.log('🔒 SECURITY LOG: Admin impersonation', {
      adminUserId: user.id,
      adminEmail: user.email,
      targetUserId,
      targetUserEmail,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Get the original magic link
    const originalLink = impersonationData.properties?.action_link
    
    if (!originalLink) {
      return NextResponse.json({ error: 'No magic link generated' }, { status: 500 })
    }
    
    // Modify the link to redirect to the correct environment
    let modifiedLink = originalLink
    
    if (process.env.NODE_ENV === 'development') {
      // Replace the redirect_to parameter with localhost
      const url = new URL(originalLink)
      url.searchParams.set('redirect_to', `${baseUrl}/users`)
      modifiedLink = url.toString()
      console.log('🔧 Modified link for development:', modifiedLink)
    }

    // Return the magic link components that can be used to sign in as the target user
    return NextResponse.json({
      success: true,
      message: 'Impersonation session created',
      impersonationLink: modifiedLink,
      originalLink: originalLink,
      targetUser: {
        id: targetUserId,
        email: targetUserEmail
      }
    })

  } catch (error) {
    console.error('❌ Impersonation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}