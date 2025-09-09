'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { hasAdminAccess } from '@/utils/roles'
import { ThemeProvider } from '@/components/ThemeProvider'
import GlobalHeader from '@/components/GlobalHeader'
import VideoManagement from '@/components/admin/VideoManagement'
import UserManagement from '@/components/admin/UserManagement'

import Hierarchy from '@/components/admin/Hierarchy'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/supabase'

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'videos' | 'users' | 'hierarchy'>('videos')
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    // Check URL parameters for tab
    const urlParams = new URLSearchParams(window.location.search)
    const tab = urlParams.get('tab')
    if (tab && ['videos', 'users', 'hierarchy'].includes(tab)) {
      setActiveTab(tab as 'videos' | 'users' | 'hierarchy')
    }

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        
        // Fetch user profile to check role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
          
          // Check for impersonation and get effective role
          const impersonationActive = localStorage.getItem('impersonation_active')
          const impersonatedUserData = localStorage.getItem('impersonation_target')
          
          let effectiveRole = profileData.role
          
          if (impersonationActive === 'true' && impersonatedUserData) {
            const impersonated = JSON.parse(impersonatedUserData)
            effectiveRole = impersonated.role
            console.log('🎭 Admin page - Impersonation detected:', {
              originalRole: profileData.role,
              effectiveRole: impersonated.role,
              impersonatedUser: impersonated
            })
          }
          
          setHasAccess(hasAdminAccess(effectiveRole))
          
          // Validate activeTab based on effective user role
          const userRole = effectiveRole || 'user'
          if (userRole === 'manager') {
            // Managers can see videos but not users or hierarchy
            if (activeTab === 'users' || activeTab === 'hierarchy') {
              setActiveTab('videos')
            }
          }
        }
      }
      
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
        } else {
          setUser(null)
          setProfile(null)
          setHasAccess(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-800 dark:border-blue-400"></div>
        </div>
      </ThemeProvider>
    )
  }

  if (!user) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
            <p className="text-blue-100">Please sign in to continue.</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  if (!hasAccess) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
          <GlobalHeader user={user} />
          <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <div className="text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
              <p className="text-blue-100 mb-2">You need Manager, Supervisor, or Admin privileges to access this area.</p>
              <p className="text-blue-200 text-sm">Current role: {profile?.role || 'Unknown'}</p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
        <GlobalHeader user={user} />
        
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-blue-100">Manage your Sparky Screen Recorder platform</p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            {!profile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading profile...</span>
              </div>
            ) : (
              <>
                {activeTab === 'videos' && <VideoManagement userRole={profile.role || 'user'} />}
                {activeTab === 'users' && <UserManagement userRole={profile.role || 'user'} />}
                {activeTab === 'hierarchy' && <Hierarchy userRole={profile.role || 'user'} />}
              </>
            )}
            
            {/* Default message when no tab is selected */}
            {!['videos', 'users', 'hierarchy'].includes(activeTab) && (
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Admin Dashboard</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Use the navigation buttons in the header to access different management sections.
                </p>
                <div className="flex justify-center space-x-4">
                  <a
                    href="/admin?tab=videos"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    🎥 Manage Videos
                  </a>
                  <a
                    href="/admin?tab=users"  
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    👥 Manage Users
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
