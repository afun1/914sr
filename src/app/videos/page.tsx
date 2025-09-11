'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VideoManagement from '@/components/admin/VideoManagement'
import GlobalHeader from '@/components/GlobalHeader'
import { ThemeProvider } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'
import { canSeeManagementPanels } from '@/utils/roles'
import type { UserRole } from '@/types/supabase'
import type { User } from '@supabase/supabase-js'

export default function VideosPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [effectiveRole, setEffectiveRole] = useState<UserRole>('user')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
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
              console.log('🔧 Videos page - Using fallback role mapping for:', currentUser.email)
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
              console.log('✅ Videos page - Fallback role assigned:', originalRole)
            }
          } catch (error) {
            // Database query failed, use fallback mapping
            console.log('❌ Videos page - Database query failed, using fallback for:', currentUser.email)
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
            console.log('✅ Videos page - Fallback role assigned after error:', originalRole)
          }
          
          setUserRole(originalRole)
          
          // Check for impersonation
          const impersonationActive = localStorage.getItem('impersonation_active')
          const impersonatedUserData = localStorage.getItem('impersonation_target')
          
          if (impersonationActive === 'true' && impersonatedUserData) {
            const impersonated = JSON.parse(impersonatedUserData)
            setEffectiveRole(impersonated.role as UserRole)
            console.log('🎭 Videos page - Impersonation detected:', {
              originalRole,
              effectiveRole: impersonated.role,
              impersonatedUser: impersonated
            })
          } else {
            setEffectiveRole(originalRole)
            console.log('👤 Videos page - Using role:', originalRole)
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
    router.push('/?redirect=videos')
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
  if (!canSeeManagementPanels(effectiveRole)) {
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
              Video Management
            </h1>
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <VideoManagement userRole={effectiveRole} />
            </Suspense>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
