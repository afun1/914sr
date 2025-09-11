// Simple test credentials for development
export const DEV_USERS = [
  {
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'admin',
    name: 'Test Admin'
  },
  {
    email: 'manager@test.com', 
    password: 'Manager123!',
    role: 'manager',
    name: 'Test Manager'
  },
  {
    email: 'user@test.com',
    password: 'User123!', 
    role: 'user',
    name: 'Test User'
  }
]

// Development mode authentication bypass
export const devAuthBypass = {
  enabled: false, // Disabled to use normal Supabase auth
  users: DEV_USERS
}
