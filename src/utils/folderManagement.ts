// Utility functions for folder management
// These can be imported by video creation components
import { supabase } from '@/lib/supabase'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API_BASE = 'https://api.vimeo.com'

export interface User {
  id: string
  email: string
  full_name?: string
  display_name?: string
  first_name?: string
  last_name?: string
  username?: string
}

export interface VideoData {
  uri: string
  name: string
  description?: string
}

export interface FolderInfo {
  name: string
  uri: string
  userId: string
  created?: boolean
}

// Function to ensure a user has a folder
export async function ensureUserHasFolder(user: User): Promise<FolderInfo | null> {
  try {
    console.log('📁 Ensuring user has folder:', user.display_name || user.full_name || user.email)

    if (!VIMEO_ACCESS_TOKEN) {
      console.error('❌ Vimeo access token not configured')
      return null
    }

    // Get all projects (folders)
    const response = await fetch(`${VIMEO_API_BASE}/me/projects`, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Failed to fetch projects for folder creation')
      return null
    }

    const data = await response.json()
    const userName = user.display_name || user.full_name || user.email?.split('@')[0] || 'Unknown User'

    // Look for existing user folder
    let userFolder = data.data.find((project: any) =>
      project.name && project.name.toLowerCase().includes(userName.toLowerCase())
    )

    if (userFolder) {
      console.log('✅ Found existing user folder:', userFolder.name)
      return userFolder
    }

    // Create new user folder
    console.log('📁 Creating new user folder for:', userName)

    const createResponse = await fetch(`${VIMEO_API_BASE}/me/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${userName} Recordings`,
        description: `Screen recordings for ${userName}`
      })
    })

    if (!createResponse.ok) {
      console.error('❌ Failed to create user folder:', createResponse.status)
      return null
    }

    const newFolder = await createResponse.json()
    console.log('✅ Created new user folder:', newFolder.name)

    return newFolder

  } catch (error) {
    console.error('❌ Error in ensureUserHasFolder:', error)
    return null
  }
}

// Function to place a video in a user's folder
export async function addVideoToUserFolder(videoData: VideoData, user: User): Promise<boolean> {
  try {
    console.log('📁 Adding video to user folder:', videoData.name)

    if (!VIMEO_ACCESS_TOKEN) {
      console.error('❌ Vimeo access token not configured')
      return false
    }

    // Get user folder
    const userFolder = await ensureUserHasFolder(user)
    if (!userFolder) {
      console.error('❌ Could not get/create user folder')
      return false
    }

    // Add video to folder
    const response = await fetch(`${VIMEO_API_BASE}${userFolder.uri}/videos${videoData.uri}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('❌ Failed to add video to user folder:', response.status)
      return false
    }

    console.log('✅ Video added to user folder successfully')
    return true

  } catch (error) {
    console.error('❌ Error in addVideoToUserFolder:', error)
    return false
  }
}

// Example usage in video creation component:
/*
import { ensureUserHasFolder, addVideoToUserFolder } from '@/utils/folderManagement'

// After video is created successfully:
const handleVideoCreated = async (videoData: VideoData, currentUser: User) => {
  console.log('🎥 Video created, ensuring user has folder...')

  // Ensure user has a folder
  const userFolder = await ensureUserHasFolder(currentUser)
  if (userFolder) {
    console.log(`📁 User folder ready: ${userFolder.name}`)

    // Add the video to the user's folder
    const added = await addVideoToUserFolder(videoData, currentUser)
    if (added) {
      console.log('✅ Video added to user folder')
    } else {
      console.log('❌ Failed to add video to folder')
    }
  } else {
    console.log('❌ Could not create/ensure user folder')
  }
}
*/