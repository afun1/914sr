'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import UserManagement from '@/components/admin/UserManagement'
import GlobalHeader from '@/components/GlobalHeader'
import { ThemeProvider } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'
import UserManagementModal from '@/components/admin/UserManagementModal'
import type { UserRole } from '@/types/supabase'
import type { User } from '@supabase/supabase-js'

export default function UsersPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [effectiveRole, setEffectiveRole] = useState<UserRole>('user')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        // Check for development mode first
        const devMode = process.env.NODE_ENV === 'development'
        let currentUser: User | null = null
        
        if (devMode) {
          // In development, check if we have a mock user from AuthProvider
          const authData = localStorage.getItem('dev-auth-user')
          if (authData) {
            currentUser = JSON.parse(authData)
            console.log('🔧 Users page - Using dev mode user:', currentUser?.email)
          }
        }
        
        // If no dev user, try Supabase
        if (!currentUser) {
          const { data: { user: supabaseUser } } = await supabase.auth.getUser()
          currentUser = supabaseUser
        }
        
        if (currentUser) {
          setUser(currentUser)
          
          let originalRole: UserRole = 'user'
          
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', currentUser.id)
              .single()
            
            if (profile) {
              originalRole = profile.role as UserRole
            } else {
              // Database profile doesn't exist, use fallback mapping
              console.log('🔧 Users page - Using fallback role mapping for:', currentUser.email)
              const roleMap: { [key: string]: UserRole } = {
                'john@tpnlife.com': 'admin',
                'john+admin@tpnlife.com': 'admin',
                'john+supervisor@tpnlife.com': 'supervisor',
                'john+3@tpnlife.com': 'supervisor',
                'john+s2@tpnlife.com': 'supervisor', 
                'john+s3@tpnlife.com': 'supervisor',
                'john+manager@tpnlife.com': 'manager',
                'john+2@tpnlife.com': 'manager',
                'john+m2@tpnlife.com': 'manager',
                'john+user@tpnlife.com': 'user',
                'john+1@tpnlife.com': 'user',
                // Development mode credentials
                'admin@test.com': 'admin',
                'manager@test.com': 'manager',
                'user@test.com': 'user'
              }
              originalRole = roleMap[currentUser.email || ''] || 'user'
              console.log('✅ Users page - Fallback role assigned:', originalRole)
            }
          } catch (error) {
            // Database query failed, use fallback mapping
            console.log('❌ Users page - Database query failed, using fallback for:', currentUser.email)
            const roleMap: { [key: string]: UserRole } = {
              'john@tpnlife.com': 'admin',
              'john+admin@tpnlife.com': 'admin',
              'john+supervisor@tpnlife.com': 'supervisor',
              'john+3@tpnlife.com': 'supervisor',
              'john+s2@tpnlife.com': 'supervisor', 
              'john+s3@tpnlife.com': 'supervisor',
              'john+manager@tpnlife.com': 'manager',
              'john+2@tpnlife.com': 'manager',
              'john+m2@tpnlife.com': 'manager',
              'john+user@tpnlife.com': 'user',
              'john+1@tpnlife.com': 'user',
              // Development mode credentials
              'admin@test.com': 'admin',
              'manager@test.com': 'manager',
              'user@test.com': 'user'
            }
            originalRole = roleMap[currentUser.email || ''] || 'user'
            console.log('✅ Users page - Fallback role assigned after error:', originalRole)
          }
          
          setUserRole(originalRole)
          
          // Check for impersonation
          const impersonationActive = localStorage.getItem('impersonation_active')
          const impersonatedUserData = localStorage.getItem('impersonation_target')
          
          if (impersonationActive === 'true' && impersonatedUserData) {
            const impersonated = JSON.parse(impersonatedUserData)
            setEffectiveRole(impersonated.role as UserRole)
            console.log('🎭 Users page - Impersonation detected:', {
              originalRole,
              effectiveRole: impersonated.role,
              impersonatedUser: impersonated
            })
          } else {
            setEffectiveRole(originalRole)
            console.log('👤 Users page - Using role:', originalRole)
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
    
    // Listen for storage changes (impersonation start/stop)
    const handleStorageChange = () => {
      fetchUserRole()
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const impersonateUser = async (userEmail: string) => {
    try {
      console.log(`🎭 Starting impersonation for: ${userEmail}`)
      
      // Sign out current user first
      await supabase.auth.signOut()
      console.log('✅ Signed out current user')
      
      // Check if user exists in auth system
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()
      
      if (listError) {
        console.error('Error listing users:', listError)
        alert(`❌ Cannot access user list: ${listError.message}`)
        return
      }
      
      let authUser = authUsers.users.find(u => u.email === userEmail)
      
      // If user doesn't exist in auth, create them
      if (!authUser) {
        console.log(`📝 Creating auth user for: ${userEmail}`)
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userEmail,
          password: 'TempPass123!',
          email_confirm: true,
          user_metadata: {
            display_name: userEmail.split('@')[0]
          }
        })
        
        if (createError) {
          console.error('Error creating user:', createError)
          alert(`❌ Failed to create user: ${createError.message}`)
          return
        }
        
        authUser = newUser.user
        console.log(`✅ Created auth user with ID: ${authUser?.id}`)
      }
      
      if (!authUser) {
        alert('❌ Could not find or create user')
        return
      }
      
      // Try direct password sign-in first
      console.log('🔐 Attempting password sign-in...')
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: 'TempPass123!'
      })
      
      if (signInData.user) {
        console.log('✅ Successfully signed in with password')
        alert(`✅ Successfully impersonating ${userEmail}!

You are now signed in as this user. 
Record a video and it will be attributed to them.

Redirecting to main app...`)
        
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
        return
      }
      
      // If password fails, try admin sign-in
      console.log('🔄 Password failed, trying admin method...')
      
      // Create a temporary session for the user
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
        options: {
          redirectTo: window.location.origin
        }
      })
      
      if (sessionError) {
        console.error('Error generating session:', sessionError)
        alert(`❌ Session error: ${sessionError.message}`)
        return
      }
      
      // Extract access token if available
      const actionLink = sessionData.properties.action_link
      console.log('📧 Generated action link:', actionLink)
      
      // Parse the URL to get tokens
      const url = new URL(actionLink)
      const accessToken = url.searchParams.get('access_token')
      const refreshToken = url.searchParams.get('refresh_token')
      
      if (accessToken && refreshToken) {
        console.log('🔑 Setting session with tokens...')
        
        const { data: sessionSetData, error: sessionSetError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        
        if (sessionSetError) {
          console.error('Error setting session:', sessionSetError)
          alert(`❌ Session setup error: ${sessionSetError.message}`)
          return
        }
        
        console.log('✅ Session set successfully')
        alert(`✅ Successfully impersonating ${userEmail}!

You are now signed in as this user.
Record a video and it will be attributed to them.

Redirecting to main app...`)
        
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
        
      } else {
        alert(`❌ Could not extract session tokens from magic link.

Try manually signing in as ${userEmail} with password: TempPass123!`)
      }
      
    } catch (error) {
      console.error('❌ Impersonation failed:', error)
      alert(`❌ Impersonation failed: ${error}

You may need to manually sign in as ${userEmail}`)
    }
  }

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ThemeProvider>
    )
  }

  if (!user) {
    // Redirect to home page for authentication
    router.push('/?redirect=users')
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Redirecting to login...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  // Check if user has permission to access management panels
  if (!['admin', 'supervisor', 'manager'].includes(effectiveRole)) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Current role: {effectiveRole}</p>
            <div className="mt-4">
              <a href="/" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                Go to Home
              </a>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GlobalHeader user={user} />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              User Management
            </h1>
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <UserManagementModal />
            </Suspense>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
