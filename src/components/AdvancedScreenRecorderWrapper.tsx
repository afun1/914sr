'use client'

import AdvancedScreenRecorder from './AdvancedScreenRecorder'
import { useUser } from './AuthWrapper'

export default function AdvancedScreenRecorderWrapper() {
  const { profile } = useUser()
  
  return (
    <AdvancedScreenRecorder userRole={profile?.role || 'user'} />
  )
}
