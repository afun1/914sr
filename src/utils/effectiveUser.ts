// Utility to get the effective user for data filtering
// This helps components show the right data when impersonating

export interface EffectiveUserData {
  id: string
  email: string
  display_name: string
  role: string
  isImpersonating: boolean
  user_metadata?: any
}

export function getEffectiveUserData(): EffectiveUserData | null {
  try {
    const stored = localStorage.getItem('effective_user_data')
    if (!stored) return null
    
    const data = JSON.parse(stored) as EffectiveUserData
    console.log('📊 Using effective user data:', data)
    return data
  } catch (error) {
    console.error('❌ Error parsing effective user data:', error)
    return null
  }
}

// Helper to get user ID for database queries
export function getEffectiveUserId(): string | null {
  const data = getEffectiveUserData()
  return data?.id || null
}

// Helper to get user email for database queries  
export function getEffectiveUserEmail(): string | null {
  const data = getEffectiveUserData()
  return data?.email || null
}

// Helper to check if currently impersonating
export function isCurrentlyImpersonating(): boolean {
  const data = getEffectiveUserData()
  return data?.isImpersonating || false
}