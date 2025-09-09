'use client'

import { Suspense, useEffect, useState } from 'react'
import Hierarchy from '@/components/admin/Hierarchy'
import GlobalHeader from '@/components/GlobalHeader'
import { ThemeProvider } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/supabase'
import type { User } from '@supabase/supabase-js'

export default function HierarchyPage() {
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          setUser(currentUser)
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single()
          
          if (profile) {
            setUserRole(profile.role as UserRole)
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
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
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Authentication Required</h2>
            <p className="text-gray-600 dark:text-gray-400">Please log in to access this page.</p>
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
              Organization Hierarchy
            </h1>
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <Hierarchy userRole={userRole} />
            </Suspense>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
