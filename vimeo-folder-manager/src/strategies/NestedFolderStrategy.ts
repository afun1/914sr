import { FolderStrategy, VimeoFolder, FolderOrganizationConfig } from '../types'

export class NestedFolderStrategy implements FolderStrategy {
  name = 'nested-folders'
  priority = 1

  async canCreate(config: FolderOrganizationConfig): Promise<boolean> {
    try {
      // Test if nested folder API is available
      const response = await fetch(`https://api.vimeo.com/me/projects/${config.parentFolderId}/folders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      return response.status !== 404
    } catch {
      return false
    }
  }

  async findExisting(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder | null> {
    try {
      // Try to get subfolders from parent
      const response = await fetch(`https://api.vimeo.com/me/projects/${parentId}/folders`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json() as { data?: VimeoFolder[] }
        const existing = data.data?.find((folder: VimeoFolder) => folder.name === childName)
        return existing || null
      }
    } catch (error) {
      console.log('Nested search failed:', error)
    }
    
    return null
  }

  async create(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder> {
    const response = await fetch(`https://api.vimeo.com/me/projects/${parentId}/folders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: childName,
        description: `Nested folder created by VimeoFolderManager`
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create nested folder: ${response.statusText}`)
    }

    return (await response.json()) as VimeoFolder
  }
}
