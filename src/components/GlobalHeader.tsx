'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface GlobalHeaderProps {
  user: any
}

export default function GlobalHeader({ user }: GlobalHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get effective user - this is what other components should use for data filtering
  const getEffectiveUser = () => {
    if (isImpersonating && impersonatedUser) {
      // When impersonating, return the real user data (not the admin)
      return {
        ...user, // Use the actual authenticated user data
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        // Override display info for UI
        display_name: impersonatedUser.display_name,
        role: impersonatedUser.role
      }
    }
    // When not impersonating, return normal user
    return user
  }

  // Get effective role
  const getEffectiveRole = () => {
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.role || 'user'
    }
    return profile?.role || 'admin' // Default to admin for john@tpnlife.com
  }

  // Get display name
  const getDisplayName = () => {
    // If impersonating, show the impersonated user's name
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.display_name || impersonatedUser.email?.split('@')[0] || 'Impersonated User'
    }
    
    // Otherwise show original user's name
    if (profile?.display_name) return profile.display_name
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    
    // Email-based name mapping
    const emailToNameMap: { [key: string]: string } = {
      'john@tpnlife.com': 'John Bradshaw',
      'jeanet@prosperityhighwayglobal.com': 'Jeanet Hazar',
    }
    
    if (user?.email && emailToNameMap[user.email]) {
      return emailToNameMap[user.email]
    }
    
    // Fallback to email username
    return user?.email?.split('@')[0] || 'User'
  }

  useEffect(() => {
    // Log effective user info for debugging
    const effectiveUser = getEffectiveUser()
    console.log('🎯 Effective user for data filtering:', {
      id: effectiveUser?.id,
      email: effectiveUser?.email,
      display_name: effectiveUser?.display_name || getDisplayName(),
      role: getEffectiveRole(),
      isImpersonating
    })

    // Store effective user in localStorage for other components to use
    if (effectiveUser) {
      const effectiveUserData = {
        id: effectiveUser.id,
        email: effectiveUser.email,
        display_name: effectiveUser.display_name || getDisplayName(),
        role: getEffectiveRole(),
        isImpersonating,
        user_metadata: effectiveUser.user_metadata
      }
      localStorage.setItem('effective_user_data', JSON.stringify(effectiveUserData))
    }
  }, [user, profile, isImpersonating, impersonatedUser])

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        console.log('🔍 Fetching profile for user:', user.email)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data && !error) {
          console.log('✅ Profile loaded:', data)
          setProfile(data)
        } else {
          console.log('🔧 Using fallback profile...')
          
          // Create fallback profile
          const fallbackProfile = {
            id: user.id,
            email: user.email || '',
            role: user.email === 'john@tpnlife.com' ? 'admin' : 'user',
            display_name: user.email === 'john@tpnlife.com' ? 'John Bradshaw' : 
                         user.email === 'jeanet@prosperityhighwayglobal.com' ? 'Jeanet Hazar' : 
                         user.email?.split('@')[0],
          }
          
          setProfile(fallbackProfile)
        }
      }
    }

    const checkImpersonation = () => {
      console.log('🔍 Checking impersonation for user:', user?.email)
      
      // Check for simple jeanet email impersonation - but use REAL user data
      if (user?.email === 'jeanet@prosperityhighwayglobal.com') {
        console.log('🎭 Detected impersonation: Using REAL Jeanet user data')
        
        setIsImpersonating(true)
        // Use the REAL user data from auth/profile, not fake data
        setImpersonatedUser({
          display_name: profile?.display_name || 'Jeanet Hazar',
          email: user.email,
          role: profile?.role || 'user',
          id: user.id, // Use the real user ID
          // Pass through any other real user data
          user_metadata: user.user_metadata,
          profile: profile
        })
        return
      }

      // Check advanced localStorage impersonation
      const impersonationActive = localStorage.getItem('impersonation_active')
      const impersonatedUserData = localStorage.getItem('impersonation_target')
      
      console.log('🔍 LocalStorage check:', {
        impersonationActive,
        hasTargetData: !!impersonatedUserData
      })

      if (impersonationActive === 'true' && impersonatedUserData) {
        try {
          const impersonatedData = JSON.parse(impersonatedUserData)
          console.log('🎭 Detected advanced impersonation with real user data:', impersonatedData)
          setIsImpersonating(true)
          setImpersonatedUser(impersonatedData)
        } catch (error) {
          console.error('❌ Error parsing impersonation data:', error)
          setIsImpersonating(false)
          setImpersonatedUser(null)
        }
      } else {
        console.log('✅ No impersonation detected')
        setIsImpersonating(false)
        setImpersonatedUser(null)
      }
    }

    fetchProfile()
    checkImpersonation()
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    // Clear all impersonation and force flags when signing out
    localStorage.removeItem('force_original_view')
    localStorage.removeItem('original_user_before_impersonation')
    localStorage.removeItem('impersonation_active')
    localStorage.removeItem('impersonation_original_user')
    localStorage.removeItem('impersonation_target')
    
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleStopImpersonation = async () => {
    console.log('🎭 Switch Back button clicked!')
    
    // Clear all impersonation data
    localStorage.removeItem('impersonation_active')
    localStorage.removeItem('impersonation_original_user')
    localStorage.removeItem('impersonation_target')
    localStorage.removeItem('original_user_before_impersonation')
    localStorage.removeItem('force_original_view')
    
    console.log('🔄 Logging out to clear impersonation completely...')
    alert('🎭 Logging out to return to your admin account. Please sign in as john@tpnlife.com')
    
    // Sign out completely - this is the cleanest approach
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>      
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg z-40">
        <div className="w-full">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo and Title */}
            <div className="flex items-center pl-4">
              <img 
                src="/Sparky AI.gif" 
                alt="Sparky AI" 
                width={32}
                height={32}
                className="mr-3 rounded-lg"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Sparky Screen Recorder
              </span>
            </div>
            
            {/* Center: Navigation Buttons */}
            <div className="flex items-center space-x-3">
              {/* Home Button */}
              <Link
                href="/"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011 1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </Link>
              
              {/* Customers Button */}
              <Link
                href="/customers"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
              >
                <span>🏢</span>
                <span>Customers</span>
              </Link>

              {/* Admin Dashboard Buttons - Show if admin role */}
              {getEffectiveRole() === 'admin' && (
                <>
                  <Link
                    href="/videos"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                  >
                    <span>🎥</span>
                    <span>Videos</span>
                  </Link>
                  <Link
                    href="/hierarchy"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                  >
                    <span>🏗️</span>
                    <span>Hierarchy</span>
                  </Link>
                  <Link
                    href="/users"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                  >
                    <span>👥</span>
                    <span>Users</span>
                  </Link>
                  <Link
                    href="/admin/folders"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                  >
                    <span>📁</span>
                    <span>Folders</span>
                  </Link>
                </>
              )}
            </div>
            
            {/* Right: User Menu */}
            <div className="flex items-center pr-4 space-x-3">
              {isImpersonating && (
                <button
                  onClick={handleStopImpersonation}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors shadow-md"
                >
                  Switch Back
                </button>
              )}
              
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {getDisplayName()}
                  </span>
                  {isImpersonating && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      Impersonating
                    </span>
                  )}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {getDisplayName()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {isImpersonating && impersonatedUser ? impersonatedUser.email : user.email}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {isImpersonating 
                          ? `${impersonatedUser?.role || 'User'} (impersonated)` 
                          : (profile?.role || 'Admin')
                        }
                      </p>
                      {isImpersonating && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          Currently impersonating this user
                        </p>
                      )}
                    </div>
                    
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          handleSignOut()
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
