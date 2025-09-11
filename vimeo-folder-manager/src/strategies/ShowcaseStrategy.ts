import { FolderStrategy, VimeoFolder, FolderOrganizationConfig } from '../types'

export class ShowcaseStrategy implements FolderStrategy {
  name = 'showcase'
  priority = 4

  async canCreate(config: FolderOrganizationConfig): Promise<boolean> {
    try {
      // Test if showcases/albums are available
      const response = await fetch('https://api.vimeo.com/me/albums', {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      return response.ok
    } catch {
      return false
    }
  }

  async findExisting(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder | null> {
    try {
      const response = await fetch('https://api.vimeo.com/me/albums', {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json() as { data?: any[] }
        const existing = data.data?.find(album => album.name === childName)
        
        if (existing) {
          // Convert album to folder-like structure
          return {
            uri: existing.uri,
            name: existing.name,
            created_time: existing.created_time,
            modified_time: existing.modified_time,
            resource_key: existing.resource_key,
            description: existing.description
          }
        }
      }
    } catch (error) {
      console.log('Showcase search failed:', error)
    }
    
    return null
  }

  async create(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder> {
    const response = await fetch('https://api.vimeo.com/me/albums', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: childName,
        description: `Showcase for ${childName} videos`,
        sort: 'added_last',
        theme: 'standard'
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create showcase: ${response.statusText}`)
    }

    const album = await response.json() as any
    
    // Convert album to folder-like structure
    return {
      uri: album.uri,
      name: album.name,
      created_time: album.created_time,
      modified_time: album.modified_time,
      resource_key: album.resource_key,
      description: album.description
    }
  }
}
