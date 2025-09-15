import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function GlobalHeader({ user }: { user: any }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null)

  // Check for impersonation on load
  useEffect(() => {
    if (user?.email) {
      console.log('👤 Checking user email:', user.email)
      
      // Simple impersonation detection: if email is jeanet, we're impersonating
      if (user.email === 'jeanet@prosperityhighwayglobal.com') {
        console.log('🎭 Detected impersonation: Jeanet Hazar')
        setIsImpersonating(true)
        setImpersonatedUser({
          display_name: 'Jeanet Hazar',
          email: user.email,
          id: user.id
        })
      }
    }
  }, [user])

  const handleSwitchBack = () => {
    // For now, just reload the page - this will return to original user
    setIsImpersonating(false)
    setImpersonatedUser(null)
    window.location.reload()
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.user-menu')) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <img 
                src="/Sparky AI.gif" 
                alt="Sparky Screen Recorder" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold">Sparky Screen Recorder</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <Link 
              href="/" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
            >
              Home
            </Link>
            <Link 
              href="/customers" 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
            >
              Customers
            </Link>
            <Link 
              href="/videos" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
            >
              Videos
            </Link>
            <Link 
              href="/hierarchy" 
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
            >
              Hierarchy
            </Link>
            {user && (
              <Link 
                href="/users" 
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
              >
                Users
              </Link>
            )}
            <Link 
              href="/admin/folders" 
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
            >
              Folders
            </Link>
          </nav>

          {/* User Menu */}
          {user ? (
            <div className="relative user-menu">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-md">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block font-medium truncate max-w-32">
                    {isImpersonating && impersonatedUser ? 
                      impersonatedUser.display_name : 
                      (user.user_metadata?.full_name || user.email?.split('@')[0] || 'User')
                    }
                  </span>
                  {isImpersonating && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      Impersonating
                    </span>
                  )}
                  <svg 
                    className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Switch Back Button - only show when impersonating */}
                {isImpersonating && (
                  <button
                    onClick={handleSwitchBack}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors shadow-md"
                  >
                    Switch Back
                  </button>
                )}
              </div>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {isImpersonating && impersonatedUser ? 
                        impersonatedUser.display_name : 
                        (user.user_metadata?.full_name || 'User')
                      }
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
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
                        setShowUserMenu(false)
                        handleSignOut()
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}