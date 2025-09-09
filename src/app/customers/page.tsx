'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeProvider'
import GlobalHeader from '@/components/GlobalHeader'
import CustomerManagement from '@/components/admin/CustomerManagement'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/supabase'

export default function CustomersPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        
        // Fetch user profile to get role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
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
            <h1 className="text-2xl font-bold text-white mb-4">Access Required</h1>
            <p className="text-blue-100">Please sign in to view customer information.</p>
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
            <h1 className="text-3xl font-bold text-white mb-2">Customer Directory</h1>
            <p className="text-blue-100">View customer information and recording history</p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            {!profile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading profile...</span>
              </div>
            ) : (
              <CustomerManagement userRole={profile.role || 'user'} />
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
