import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return new NextResponse(JSON.stringify({ error: 'Supabase service key not configured' }), { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, first_name, last_name, email, role, created_at')
      .order('display_name')

    if (error) {
      return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ error: err?.message || String(err) }), { status: 500 })
  }
}
