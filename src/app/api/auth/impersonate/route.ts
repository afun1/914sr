import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = await req.json()

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      )
    }

    // Create server client with cookies
    const cookieStore = cookies()
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Get current user and verify admin role
    const { data: { user: currentUser }, error: userError } = await supabaseServer.auth.getUser()
    
    if (userError || !currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if current user is admin
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profileError || currentProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    // Verify target user exists
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      )
    }

    // Use admin client to sign in as target user
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Generate a one-time login token for the target user
    const { data: tokenData, error: tokenError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: targetProfile.email,
      options: {
        redirectTo: `${req.nextUrl.origin}?impersonated=true`
      }
    })

    if (tokenError || !tokenData.properties?.action_link) {
      console.error('Token generation error:', tokenError)
      return NextResponse.json(
        { error: 'Failed to generate login token' },
        { status: 500 }
      )
    }

    // Extract the token from the magic link
    const actionLink = tokenData.properties.action_link
    const tokenMatch = actionLink.match(/token=([^&]+)/)
    const token = tokenMatch ? tokenMatch[1] : null

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to extract token from magic link' },
        { status: 500 }
      )
    }

    // Sign in using the token
    const { data: sessionData, error: sessionError } = await supabaseServer.auth.verifyOtp({
      type: 'magiclink',
      token: decodeURIComponent(token),
      email: targetProfile.email
    })

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create impersonation session' },
        { status: 500 }
      )
    }

    console.log('✅ Successfully impersonated user:', targetProfile.email)

    return NextResponse.json({
      success: true,
      message: `Successfully impersonating ${targetProfile.full_name || targetProfile.email}`,
      user: sessionData.user
    })

  } catch (error) {
    console.error('❌ Impersonation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}