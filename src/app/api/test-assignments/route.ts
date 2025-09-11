import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 API: Fetching profiles with assignment data...')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, assigned_to_admin, assigned_to_supervisor, assigned_to_manager, assigned_at, assigned_by')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ API Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ API: Found profiles:', data?.length || 0)
    
    const profilesWithAssignments = data?.map(profile => ({
      email: profile.email,
      role: profile.role,
      assignments: {
        admin: profile.assigned_to_admin,
        supervisor: profile.assigned_to_supervisor,
        manager: profile.assigned_to_manager,
        assigned_at: profile.assigned_at,
        assigned_by: profile.assigned_by
      }
    }))

    return NextResponse.json({ 
      success: true, 
      profiles: profilesWithAssignments,
      count: data?.length || 0
    })
  } catch (error) {
    console.error('❌ API Exception:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
