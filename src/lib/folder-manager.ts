import { supabase } from '@/lib/supabase'

// Function to ensure user has a folder in folder manager
export async function ensureUserFolder(userEmail: string, displayName?: string) {
  try {
    console.log(`📁 Checking if folder exists for user: ${userEmail}`)
    
    // Check if user already has a folder
    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('*')
      .eq('owner_email', userEmail)
      .single()
    
    if (existingFolder) {
      console.log(`✅ Folder already exists for ${userEmail}:`, existingFolder.name)
      return existingFolder
    }
    
    // Create new folder for user
    console.log(`🆕 Creating new folder for ${userEmail}`)
    
    const folderName = displayName || userEmail.split('@')[0]
    
    const { data: newFolder, error: createError } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        owner_email: userEmail,
        created_at: new Date().toISOString(),
        description: `Screen recordings for ${displayName || userEmail}`,
        is_active: true
      })
      .select()
      .single()
    
    if (createError) {
      console.error('❌ Error creating folder:', createError)
      throw createError
    }
    
    console.log(`✅ Created folder for ${userEmail}:`, newFolder.name)
    return newFolder
    
  } catch (error) {
    console.error('❌ Error in ensureUserFolder:', error)
    throw error
  }
}

// Function to add video to user's folder
export async function addVideoToUserFolder(userEmail: string, videoData: any) {
  try {
    console.log(`🎥 Adding video to ${userEmail}'s folder`)
    
    // Ensure user has a folder
    const userFolder = await ensureUserFolder(userEmail, videoData.userDisplayName)
    
    // Add video to the folder
    const { data: folderVideo, error } = await supabase
      .from('folder_videos')
      .insert({
        folder_id: userFolder.id,
        vimeo_id: videoData.vimeoId,
        title: videoData.title || `Recording ${new Date().toLocaleDateString()}`,
        description: videoData.description || '',
        thumbnail_url: videoData.thumbnail,
        duration: videoData.duration || 0,
        created_at: videoData.createdAt || new Date().toISOString(),
        user_email: userEmail,
        player_url: videoData.playerUrl
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error adding video to folder:', error)
      throw error
    }
    
    console.log(`✅ Video added to ${userEmail}'s folder:`, folderVideo.title)
    return folderVideo
    
  } catch (error) {
    console.error('❌ Error in addVideoToUserFolder:', error)
    throw error
  }
}

// Function to get user's folder and videos
export async function getUserFolderWithVideos(userEmail: string) {
  try {
    console.log(`📂 Fetching folder and videos for ${userEmail}`)
    
    const { data, error } = await supabase
      .from('folders')
      .select(`
        *,
        folder_videos (
          *
        )
      `)
      .eq('owner_email', userEmail)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error fetching user folder:', error)
      throw error
    }
    
    return data
    
  } catch (error) {
    console.error('❌ Error in getUserFolderWithVideos:', error)
    return null
  }
}

// Function to create folder for Nicolaas specifically
export async function createNicolaasFolder() {
  try {
    console.log('🆕 Creating folder for Nicolaas...')
    
    const nicolaasEmail = 'nicolaas.phg@example.com' // Update with his actual email
    const folder = await ensureUserFolder(nicolaasEmail, 'Nicolaas')
    
    console.log('✅ Nicolaas folder created:', folder)
    return folder
    
  } catch (error) {
    console.error('❌ Error creating Nicolaas folder:', error)
    throw error
  }
}