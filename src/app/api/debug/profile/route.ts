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
    console.log('🧪 Profile debug test started')
    
    // Get token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No auth header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify user with regular client
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Token invalid', details: userError }, { status: 401 })
    }

    console.log('👤 User verified:', user.email)

    // Test 1: Try with regular client
    console.log('🧪 Test 1: Regular client profile lookup')
    const { data: regularProfile, error: regularError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Test 2: Try with admin client
    console.log('🧪 Test 2: Admin client profile lookup')
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Test 3: List all profiles with admin client
    console.log('🧪 Test 3: Admin client all profiles')
    const { data: allProfiles, error: allError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .limit(10)

    // Test 4: Check table structure
    console.log('🧪 Test 4: Check profiles table structure')
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'profiles')

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      tests: {
        regularClient: {
          data: regularProfile,
          error: regularError?.message || null
        },
        adminClient: {
          data: adminProfile,
          error: adminError?.message || null
        },
        allProfiles: {
          count: allProfiles?.length || 0,
          data: allProfiles,
          error: allError?.message || null
        },
        tableStructure: {
          columns: tableInfo,
          error: tableError?.message || null
        }
      }
    })

  } catch (error) {
    console.error('❌ Profile debug error:', error)
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}