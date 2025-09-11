// Integration example for the Sparky Screen Recorder project
import { VimeoFolderManager } from '../src/VimeoFolderManager'

// Initialize the manager with your specific configuration
export const sparkyVimeoManager = new VimeoFolderManager({
  accessToken: process.env.VIMEO_ACCESS_TOKEN || '',
  parentFolderId: '26555277', // Your SSR folder ID
  parentFolderName: 'Sparky Screen Recordings',
  organizationPattern: 'enhanced-flat',
  namingConvention: {
    prefix: '📁 SSR',
    separator: ' • ',
    useEmoji: true
  },
  fallbackStrategies: ['virtual-path', 'nested'],
  retryOptions: {
    maxRetries: 3,
    retryDelay: 1000
  }
})

// Example usage in your existing vimeo.ts file
export async function createLiaisonFolderWithManager(
  userDisplayName: string, 
  userEmail: string
): Promise<any> {
  try {
    console.log('🚀 Using VimeoFolderManager for:', userDisplayName)
    
    const result = await sparkyVimeoManager.createOrganizedFolder(
      '26555277', // SSR parent folder
      userDisplayName
    )
    
    console.log(`✅ Folder organized with strategy: ${result.strategy}`)
    console.log(`📁 Folder name: ${result.folder.name}`)
    console.log(`🔄 Was existing: ${result.wasExisting}`)
    
    return {
      uri: result.folder.uri,
      name: result.folder.name,
      created_time: result.folder.created_time,
      modified_time: result.folder.modified_time,
      resource_key: result.folder.resource_key
    }
    
  } catch (error) {
    console.error('❌ VimeoFolderManager failed:', error)
    
    // Fallback to your existing logic
    throw error
  }
}

// Integration helper for video uploads
export async function uploadVideoToOrganizedFolder(
  file: File,
  customerName: string,
  customerEmail: string,
  userDisplayName: string,
  title?: string,
  description?: string
) {
  // 1. Create/find organized folder
  const folderResult = await sparkyVimeoManager.createOrganizedFolder(
    '26555277',
    userDisplayName
  )
  
  // 2. Create upload ticket with folder assignment
  // TODO: Integrate with your existing createUploadTicket function
  /*
  const uploadTicket = await createVimeoUploadTicket(
    file.size,
    file.name,
    folderResult.folder.uri,
    {
      title: title || `${customerName} - Screen Recording`,
      description: `Customer: ${customerName}\nEmail: ${customerEmail}\nRecorded by: ${userDisplayName}\n\n${description || 'Screen recording session'}`,
      customerName,
      customerEmail
    }
  )
  */
  
  return {
    // uploadTicket,
    folder: folderResult.folder,
    organizationInfo: {
      strategy: folderResult.strategy,
      wasExisting: folderResult.wasExisting
    }
  }
}

// Helper function to migrate existing folders to new naming
export async function migrateToEnhancedNaming() {
  console.log('🔄 Starting folder migration to enhanced naming...')
  
  // Search for folders with old naming patterns
  const oldPatternFolders = await sparkyVimeoManager.searchFolders('SSR -')
  
  console.log(`Found ${oldPatternFolders.length} folders with old pattern`)
  
  // TODO: Implement migration logic if needed
  // This would rename existing folders to the new enhanced format
  
  return {
    found: oldPatternFolders.length,
    migrated: 0 // Placeholder
  }
}

// Performance monitoring
export function getVimeoManagerStats() {
  return {
    strategies: sparkyVimeoManager.getStrategyStats(),
    cacheStats: {
      // Cache statistics would go here
    }
  }
}
