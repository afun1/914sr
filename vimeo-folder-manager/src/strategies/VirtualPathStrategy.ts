import { FolderStrategy, VimeoFolder, FolderOrganizationConfig } from '../types'

export class VirtualPathStrategy implements FolderStrategy {
  name = 'virtual-path'
  priority = 2

  async canCreate(config: FolderOrganizationConfig): Promise<boolean> {
    // Virtual paths always work since they're just naming conventions
    return true
  }

  async findExisting(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder | null> {
    try {
      const virtualName = `${config.parentFolderName || 'Parent'}/${childName}`
      
      const response = await fetch('https://api.vimeo.com/me/folders', {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json() as { data?: VimeoFolder[] }
        
        // First, try to find existing virtual path folder
        let existing = data.data?.find(folder => folder.name === virtualName)
        if (existing) {
          console.log(`✅ Found existing virtual path folder: ${existing.name}`)
          return existing
        }
        
        // If no virtual path folder exists, look for legacy folder with just the child name
        existing = data.data?.find(folder => folder.name === childName)
        if (existing) {
          console.log(`✅ Found existing legacy folder: ${existing.name}, will reuse it`)
          return existing
        }
      }
    } catch (error) {
      console.log('Virtual path search failed:', error)
    }
    
    return null
  }

  async create(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder> {
    const virtualName = `${config.parentFolderName || 'Parent'}/${childName}`
    
    const response = await fetch('https://api.vimeo.com/me/folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: virtualName,
        description: `Virtual nested folder: ${config.parentFolderName || 'Parent'} > ${childName}`
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create virtual path folder: ${response.statusText}`)
    }

    return await response.json() as VimeoFolder
  }
}
