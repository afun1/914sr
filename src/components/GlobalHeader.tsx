'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTheme } from './ThemeProvider'
import ChangePassword from './ChangePassword'
import { hasAdminAccess, getRoleDisplay, canSeeManagementPanels, hasEditingRights } from '@/utils/roles'
import type { User } from '@supabase/supabase-js'
import type { Profile, UserRole } from '@/types/supabase'

interface GlobalHeaderProps {
  user: User
}

export default function GlobalHeader({ user }: GlobalHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [originalUser, setOriginalUser] = useState<any>(null)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Create display name function with liaison mapping
  const getDisplayName = () => {
    // If impersonating, show the impersonated user's name
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.display_name || impersonatedUser.email?.split('@')[0] || 'Impersonated User'
    }
    
    // Otherwise show original user's name
    if (profile?.display_name) return profile.display_name
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    
    // Email-based name mapping for liaisons
    const emailToNameMap: { [key: string]: string } = {
      'john@tpnlife.com': 'John Bradshaw',
      'john+test@tpnlife.com': 'John Bradshaw',
      'john+admin@tpnlife.com': 'John Bradshaw',
      'john+1@tpnlife.com': 'John User',
      'john+2@tpnlife.com': 'John Manager',
      'john+s2@tpnlife.com': 'John S2',
      'john+s3@tpnlife.com': 'John S3',
      'john+user@tpnlife.com': 'John User',
      'john+manager@tpnlife.com': 'John Manager',
    }
    
    if (user?.email) {
      // Check exact email match first
      if (emailToNameMap[user.email]) {
        return emailToNameMap[user.email]
      }
      
      // For unmapped john+ emails, create a name from the email prefix
      if (user.email.startsWith('john+') && user.email.includes('@tpnlife.com')) {
        const prefix = user.email.split('@')[0].replace('john+', '')
        return `John ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`
      }
    }
    
    // Fallback to email username or full email
    return user?.email?.split('@')[0] || user?.email || 'User'
  }

  // Get effective role (considering impersonation)
  const getEffectiveRole = () => {
    if (isImpersonating && impersonatedUser) {
      console.log('🎭 Using impersonated role:', impersonatedUser.role)
      return impersonatedUser.role
    }
    console.log('👤 Using profile role:', profile?.role, 'for user:', user?.email)
    return profile?.role || 'user'
  }

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        console.log('🔍 Fetching profile for user:', user.email, 'ID:', user.id)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data && !error) {
          console.log('✅ Profile loaded:', {
            email: data.email,
            role: data.role,
            display_name: data.display_name,
            id: data.id
          })
          setProfile(data)
        } else {
          console.error('❌ Profile fetch error:', error)
          console.log('🔧 Using fallback profile for missing database record...')
          
          // Create a fallback profile object for the session
          // without trying to insert into database due to policy issues
          const roleMap: { [key: string]: string } = {
            // Development users
            'admin@test.com': 'admin',
            'manager@test.com': 'manager',
            'user@test.com': 'user',
            // Production users
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
            'john+1@tpnlife.com': 'user'
          }
          
          const nameMap: { [key: string]: string } = {
            // Development users
            'admin@test.com': 'Test Admin',
            'manager@test.com': 'Test Manager',
            'user@test.com': 'Test User',
            // Production users
            'john@tpnlife.com': 'John Bradshaw',
            'john+admin@tpnlife.com': 'John Bradshaw',
            'john+supervisor@tpnlife.com': 'John Supervisor',
            'john+3@tpnlife.com': 'John 3',
            'john+s2@tpnlife.com': 'John S2',
            'john+s3@tpnlife.com': 'John S3',
            'john+manager@tpnlife.com': 'John Manager',
            'john+2@tpnlife.com': 'John 2',
            'john+m2@tpnlife.com': 'John M2',
            'john+user@tpnlife.com': 'John User',
            'john+1@tpnlife.com': 'John 1'
          }
          
          const defaultRole = roleMap[user.email || ''] || 'user'
          const defaultName = nameMap[user.email || ''] || (user.email?.split('@')[0] || 'User')
          
          // Create fallback profile for UI purposes
          const fallbackProfile = {
            id: user.id,
            email: user.email || '',
            role: defaultRole as UserRole,
            display_name: defaultName,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          console.log('✅ Using fallback profile:', fallbackProfile)
          setProfile(fallbackProfile)
        }
      }
    }

    const checkImpersonation = () => {
      const impersonationActive = localStorage.getItem('impersonation_active')
      const originalUserData = localStorage.getItem('impersonation_original_user')
      const impersonatedUserData = localStorage.getItem('impersonation_target')

      if (impersonationActive === 'true' && originalUserData && impersonatedUserData) {
        setIsImpersonating(true)
        setOriginalUser(JSON.parse(originalUserData))
        setImpersonatedUser(JSON.parse(impersonatedUserData))
      } else {
        setIsImpersonating(false)
        setOriginalUser(null)
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
    // Clear development user data
    localStorage.removeItem('dev-auth-user')
    
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleStopImpersonation = () => {
    // Clear impersonation data
    localStorage.removeItem('impersonation_active')
    localStorage.removeItem('impersonation_original_user')
    localStorage.removeItem('impersonation_target')
    
    // Notify user
    alert('🎭 Impersonation stopped. Returning to your original account.')
    
    // Reload to restore original user context
    window.location.reload()
  }

  return (
    <>
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-yellow-500 text-black px-4 py-2 text-center text-sm font-medium sticky top-0 z-50">
          <div className="flex items-center justify-center space-x-4">
            <span>
              🎭 <strong>IMPERSONATION ACTIVE:</strong> You are viewing as {impersonatedUser?.display_name || impersonatedUser?.email}
            </span>
            <button
              onClick={handleStopImpersonation}
              className="bg-black text-yellow-500 px-3 py-1 rounded text-xs font-bold hover:bg-gray-800 transition-colors"
            >
              Stop Impersonation
            </button>
          </div>
        </div>
      )}
      
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-800">
        <div className="w-full">
          <div className="flex items-center justify-between h-16 px-0">
            {/* Left: Logo and Title */}
            <div className="flex items-center">
              <Image 
                src="/Sparky AI.gif" 
                alt="Sparky AI" 
                width={32}
                height={32}
                className="mr-3 rounded-lg ml-2"
                unoptimized
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
                prefetch={true}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011 1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </Link>
              
              {/* Customers Button - Available for all logged-in users */}
              <Link
                href="/customers"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                prefetch={true}
              >
                <span>🏢</span>
                <span>Customers</span>
              </Link>

              {/* Admin Dashboard Buttons - Show only if user has admin access (considering impersonation) */}
              {(() => {
                const effectiveRole = getEffectiveRole();
                const canSee = canSeeManagementPanels(effectiveRole);
                console.log('🔒 Management panel check:', {
                  effectiveRole,
                  canSeeManagementPanels: canSee,
                  userEmail: user?.email
                });
                return canSee;
              })() && (
                <div className="flex items-center space-x-3">
                  <Link
                    href="/videos"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                    prefetch={true}
                  >
                    <span>🎥</span>
                    <span>Videos</span>
                  </Link>
                  <Link
                    href="/hierarchy"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                    prefetch={true}
                  >
                    <span>🏗️</span>
                    <span>Hierarchy</span>
                  </Link>
                  <Link
                    href="/users"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                    prefetch={true}
                  >
                    <span>👥</span>
                    <span>Users</span>
                  </Link>
                </div>
              )}
              
              {/* Liaison Folders Button - Show only if user has admin access (considering impersonation) */}
              {hasEditingRights(getEffectiveRole()) && (
                <Link
                  href="/admin/folders"
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-b from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium transform hover:scale-105"
                  prefetch={true}
                >
                  <span>�</span>
                  <span>Liaison Folders</span>
                </Link>
              )}
            </div>
            
            {/* Right: User Menu */}
            <div className="flex items-center mr-2">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm">
                    {getDisplayName()}
                  </span>
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
                      {(profile?.role || impersonatedUser?.role) && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {isImpersonating 
                            ? `${getRoleDisplay(impersonatedUser.role).label} (impersonated)` 
                            : getRoleDisplay(profile!.role).label
                          }
                        </p>
                      )}
                    </div>
                    
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowChangePassword(true)
                          setShowDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span>Change Password</span>
                      </button>
                      
                      <button
                        onClick={toggleTheme}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                      >
                        {theme === 'dark' ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>Light Mode</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                            <span>Dark Mode</span>
                          </>
                        )}
                      </button>
                      
                      {isImpersonating && (
                        <button
                          onClick={() => {
                            handleStopImpersonation()
                            setShowDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 border-t border-gray-200 dark:border-gray-700"
                        >
                          <span>🎭</span>
                          <span>Stop Impersonation</span>
                        </button>
                      )}
                      
                      <button
                        onClick={handleSignOut}
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

      {showChangePassword && (
        <ChangePassword onClose={() => setShowChangePassword(false)} />
      )}
    </>
  )
}
