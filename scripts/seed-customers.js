const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = 'https://bwvxctexiseobyqcublc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dnhjdGV4aXNlb2J5cWN1YmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzc1NzMsImV4cCI6MjA3MDg1MzU3M30.7QGmKxE24-BfEJpxFrxORAJuN_ZLzt9-d6904Gx0ug'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fake customer data
const fakeCustomers = [
  {
    email: 'sarah.johnson@email.com',
    display_name: 'Sarah Johnson',
    role: 'customer'
  },
  {
    email: 'mike.davis@email.com', 
    display_name: 'Mike Davis',
    role: 'customer'
  },
  {
    email: 'jennifer.wilson@email.com',
    display_name: 'Jennifer Wilson', 
    role: 'customer'
  },
  {
    email: 'david.brown@email.com',
    display_name: 'David Brown',
    role: 'customer'
  },
  {
    email: 'lisa.garcia@email.com',
    display_name: 'Lisa Garcia',
    role: 'customer'
  },
  {
    email: 'robert.martinez@email.com',
    display_name: 'Robert Martinez',
    role: 'customer'
  },
  {
    email: 'amanda.taylor@email.com',
    display_name: 'Amanda Taylor',
    role: 'customer'
  },
  {
    email: 'christopher.anderson@email.com',
    display_name: 'Christopher Anderson',
    role: 'customer'
  },
  {
    email: 'melissa.thomas@email.com',
    display_name: 'Melissa Thomas',
    role: 'customer'
  },
  {
    email: 'james.jackson@email.com',
    display_name: 'James Jackson',
    role: 'customer'
  }
]

async function seedCustomers() {
  try {
    console.log('🌱 Starting to seed fake customers...')
    
    // Insert customers
    const { data, error } = await supabase
      .from('profiles')
      .insert(fakeCustomers)
      .select()
    
    if (error) {
      console.error('❌ Error inserting customers:', error)
      return
    }
    
    console.log('✅ Successfully created', data.length, 'fake customers:')
    data.forEach(customer => {
      console.log(`   • ${customer.display_name} (${customer.email})`)
    })
    
    console.log('\n🎉 Seeding complete! You can now test the app with these customers.')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the seeding
seedCustomers()
