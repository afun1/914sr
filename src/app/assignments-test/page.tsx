'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeProvider'
import GlobalHeader from '@/components/GlobalHeader'
import type { User } from '@supabase/supabase-js'

export default function AssignmentsTestPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/?redirect=assignments')
        return
      }

      // Restrict access to john@tpnlife.com only
      if (user.email !== 'john@tpnlife.com') {
        router.push('/dashboard')
        return
      }

      setUser(user)
    } catch (error) {
      console.error('Error checking access:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ThemeProvider>
    )
  }

  if (!user) {
    return null
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GlobalHeader user={user} />
        
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Assignment Management - TEST
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              This is a test page to verify access works (Restricted to john@tpnlife.com)
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🎉 Success! You can access the assignments area!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              User: {user.email}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              If you can see this page, the assignment system access is working correctly.
            </p>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}