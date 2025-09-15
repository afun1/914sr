'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GlobalHeader from '@/components/GlobalHeader'

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    role: ''
  })
  const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set())
  const [updatingUser, setUpdatingUser] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  // Add impersonation handler
  const handleImpersonateUser = async (targetUser: any) => {
    if (!confirm(`🚨 DANGER: Are you sure you want to impersonate ${targetUser.email}? This will log you in as them!`)) {
      return
    }

    setImpersonating(true)
    
    try {
      console.log('🎭 Starting impersonation of:', targetUser.email)
      
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No valid session found')
      }
      
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: targetUser.id,
          targetUserEmail: targetUser.email,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('🎭 Impersonation successful:', result)
        
        if (result.impersonationLink) {
          // Store impersonation state before redirect
          localStorage.setItem('impersonation_data', JSON.stringify({
            originalUserId: currentUser?.id,
            originalUserEmail: currentUser?.email,
            targetUserId: targetUser.id,
            targetUserEmail: targetUser.email,
            timestamp: new Date().toISOString()
          }))
          
          // Force localhost redirect by modifying the URL
          let impersonationUrl = result.impersonationLink
          console.log('🔍 Original impersonation URL:', impersonationUrl)
          
          // Always modify the URL to point to localhost in development
          if (window.location.hostname === 'localhost') {
            try {
              const url = new URL(impersonationUrl)
              console.log('🔍 Original redirect_to:', url.searchParams.get('redirect_to'))
              
              // Force the redirect to localhost
              url.searchParams.set('redirect_to', `${window.location.origin}/users`)
              impersonationUrl = url.toString()
              console.log('🔧 Modified URL for localhost:', impersonationUrl)
            } catch (urlError) {
              console.warn('⚠️ Could not modify URL, using original:', urlError)
            }
          }
          
          // Redirect to the magic link to sign in as the target user
          console.log('🚀 Final URL:', impersonationUrl)
          alert(`🎭 Impersonation activated! Redirecting to sign in as ${targetUser.email}`)
          
          // For localhost, try opening in same window
          if (window.location.hostname === 'localhost') {
            window.location.href = impersonationUrl
          } else {
            // For production, use direct redirect
            window.location.href = impersonationUrl
          }
        } else {
          throw new Error('No impersonation link received')
        }
      } else {
        const error = await response.json()
        console.error('❌ Impersonation failed:', error)
        alert('Impersonation failed: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Error during impersonation:', error)
      alert('Error during impersonation: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setImpersonating(false)
    }
  }

  useEffect(() => {
    getCurrentUser()
    fetchUsers()
  }, [])

  // ...existing code for getCurrentUser, fetchUsers, handleEditUser, etc...
}