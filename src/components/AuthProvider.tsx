'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import GlobalHeader from './GlobalHeader'

interface AuthProviderProps {
  children: React.ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const getSession = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase timeout')), 5000)
        )
        
        const sessionPromise = supabase.auth.getSession()
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any
        setUser(session?.user ?? null)
        setLoading(false)
      } catch (error) {
        console.error('Supabase auth error:', error)
        // For now, bypass auth errors and continue loading
        setUser(null)
        setLoading(false)
      }
    }

    getSession()

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null)
          setLoading(false)
          
          // Reset verification state when user signs in
          if (event === 'SIGNED_IN') {
            setShowVerification(false)
            setVerificationEmail('')
          }
        }
      )

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('Supabase subscription error:', error)
      return () => {}
    }
  }, [])

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*()_+]/.test(password)
    
    return minLength && hasUpper && hasLower && hasNumber && hasSpecial
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setError('')

    if (!validatePassword(formData.password)) {
      setError('Password must meet all requirements')
      setAuthLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          }
        }
      })

      if (error) {
        setError(error.message)
      } else if (data.user && !data.session) {
        // User created but needs email verification
        setVerificationEmail(formData.email)
        setShowVerification(true)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('') // Clear error when user types
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email) {
      setError('Please enter your email address')
      return
    }

    setAuthLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setVerificationEmail(formData.email)
        setShowVerification(true)
        setShowForgotPassword(false)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setAuthLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-800 dark:border-blue-400"></div>
      </div>
    )
  }

  if (!user) {
    // Show verification message if user just signed up
    if (showVerification) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
          <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <div className="text-center">
              <div className="mb-4">
                <img 
                  src="/Sparky AI.gif" 
                  alt="Sparky AI Logo" 
                  className="w-16 h-16 mx-auto"
                />
              </div>
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Check Your Email
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {showForgotPassword ? 'A password reset link has been sent to' : 'A verification link has been sent to'}
              </p>
              <p className="font-semibold text-blue-600 dark:text-blue-400 mb-4">
                {verificationEmail}
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                {showForgotPassword 
                  ? 'Please check your email and click the reset link to create a new password. If you don\'t see it, please check your spam folder.'
                  : 'Please check your email and click the verification link to complete your signup. If you don\'t see it, please check your spam folder.'
                }
              </p>
              <button
                onClick={() => {
                  setShowVerification(false)
                  setIsSignUp(false)
                  setFormData({ name: '', email: '', password: '' })
                }}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Show forgot password form
    if (showForgotPassword) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
          <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <div className="text-center">
              <div className="mb-4">
                <img 
                  src="/Sparky AI.gif" 
                  alt="Sparky AI Logo" 
                  className="w-16 h-16 mx-auto"
                />
              </div>
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Reset Password
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setError('')
                    setFormData({ name: '', email: '', password: '' })
                  }}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="text-center">
            <div className="mb-4">
              <img 
                src="/Sparky AI.gif" 
                alt="Sparky AI Logo" 
                className="w-16 h-16 mx-auto"
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Sparky Screen Recorder
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {isSignUp ? 'Create your account to start recording' : 'Sign in to start recording with lightning speed'}
            </p>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your password"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                At least 8 characters, 1 CAPITAL, 1 lowercase, 1 number and 1 special character !@#$%^&*()_+
              </p>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                isSignUp ? 'Sign Up' : 'Sign In'
              )}
            </button>

            <div className="text-center space-y-3">
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true)
                    setError('')
                  }}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium block w-full"
                >
                  Forgot your password?
                </button>
              )}
              
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  setFormData({ name: '', email: '', password: '' })
                }}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-200 to-blue-800 dark:from-blue-900 dark:to-blue-950">
      <GlobalHeader user={user} />
      {children}
    </div>
  )
}
