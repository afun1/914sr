import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔄 Fetching customers for recording page...')
    
    // Get customers from your existing customer management system
    // This should match whatever query your /customers page uses
    const { data: customers, error } = await supabase
      .from('customers') // or whatever table name you use
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch customers',
        customers: [] 
      }, { status: 500 })
    }

    // Transform the data to match what the recording page expects
    const formattedCustomers = customers?.map((customer: any) => ({
      name: customer.name || customer.customer_name,
      email: customer.email || customer.customer_email,
      videoCount: customer.video_count || 0,
      lastRecording: customer.last_recording || customer.updated_at,
      customerSince: customer.created_at
    })) || []

    console.log(`✅ Loaded ${formattedCustomers.length} customers from database`)
    
    return NextResponse.json({
      success: true,
      customers: formattedCustomers,
      total: formattedCustomers.length
    })

  } catch (error) {
    console.error('Error in customers API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      customers: []
    }, { status: 500 })
  }
}

// Optional: POST endpoint to add new customers
export async function POST(req: NextRequest) {
  try {
    const { name, email, displayName } = await req.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if customer already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Customer already exists' },
        { status: 409 }
      )
    }

    // Insert new customer
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: email,
        display_name: displayName || name || email.split('@')[0]
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: data.id,
        name: data.display_name,
        email: data.email
      }
    })

  } catch (error) {
    console.error('Error in customers API POST:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}