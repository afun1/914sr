'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/supabase'

interface UserContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true
})

export const useUser = () => useContext(UserContext)

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase timeout')), 3000)
        )
        
        const sessionPromise = supabase.auth.getSession()
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any
        setUser(session?.user ?? null)
        
        // Skip profile loading for now to prevent hanging
        console.log('User session loaded, skipping profile fetch')
        setProfile(null) // Set to null immediately
        setLoading(false)
        
      } catch (error) {
        console.error('AuthWrapper session error:', error)
        // Bypass auth errors and continue loading
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }

    getSession()

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null)
          
          // Skip profile loading in auth state change too
          console.log('Auth state changed, skipping profile fetch')
          setProfile(null)
          setLoading(false)
        }
      )

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('AuthWrapper subscription error:', error)
      setLoading(false)
      return () => {}
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return null // This will be handled by AuthProvider at the layout level
  }

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  )
}
