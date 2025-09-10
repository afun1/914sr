// Intelligent Vimeo Folder Manager
// This library implements multiple strategies to achieve proper folder organization

import { AdvancedVimeoService } from './vimeo-advanced'

interface FolderStrategy {
  name: string
  priority: number
  canCreate: () => Promise<boolean>
  create: (parentId: string, childName: string) => Promise<any>
  findExisting: (parentId: string, childName: string) => Promise<any>
}

export class IntelligentVimeoFolderManager {
  private vimeoService: AdvancedVimeoService
  private strategies: FolderStrategy[] = []

  constructor(accessToken: string) {
    this.vimeoService = new AdvancedVimeoService(accessToken)
    this.initializeStrategies()
  }

  private initializeStrategies() {
    // Strategy 1: True Nested Folders (if API supports it)
    this.strategies.push({
      name: 'native-nested',
      priority: 1,
      canCreate: async () => {
        // Test if true nesting is supported
        try {
          await this.testNestedFolderSupport()
          return true
        } catch {
          return false
        }
      },
      create: async (parentId: string, childName: string) => {
        return await this.vimeoService.createProjectSubfolder(parentId, childName)
      },
      findExisting: async (parentId: string, childName: string) => {
        // Implementation for finding nested folders
        return null
      }
    })

    // Strategy 2: Virtual Paths with Smart Naming
    this.strategies.push({
      name: 'virtual-paths',
      priority: 2,
      canCreate: async () => true,
      create: async (parentId: string, childName: string) => {
        return await this.vimeoService.createVirtualNestedFolder('Sparky Screen Recordings', childName)
      },
      findExisting: async (parentId: string, childName: string) => {
        // Find folders with virtual path naming
        const virtualName = `Sparky Screen Recordings/${childName}`
        return await this.findFolderByName(virtualName)
      }
    })

    // Strategy 3: Collections/Showcases
    this.strategies.push({
      name: 'showcases',
      priority: 3,
      canCreate: async () => {
        try {
          // Test if showcases are available for this account
          const response = await fetch('https://api.vimeo.com/me/albums', {
            headers: { 'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}` }
          })
          return response.ok
        } catch {
          return false
        }
      },
      create: async (parentId: string, childName: string) => {
        return await this.vimeoService.createNestedShowcase(parentId, childName)
      },
      findExisting: async (parentId: string, childName: string) => {
        // Find existing showcase
        return null
      }
    })

    // Strategy 4: Enhanced Flat Structure (fallback)
    this.strategies.push({
      name: 'enhanced-flat',
      priority: 4,
      canCreate: async () => true,
      create: async (parentId: string, childName: string) => {
        return await this.createEnhancedFlatFolder(childName)
      },
      findExisting: async (parentId: string, childName: string) => {
        const enhancedName = `📁 SSR • ${childName}`
        return await this.findFolderByName(enhancedName)
      }
    })

    // Sort by priority
    this.strategies.sort((a, b) => a.priority - b.priority)
  }

  async createOrganizedFolder(parentFolderId: string, liaisonName: string): Promise<any> {
    console.log('🚀 Starting intelligent folder creation for:', liaisonName)

    for (const strategy of this.strategies) {
      try {
        console.log(`🧪 Testing strategy: ${strategy.name}`)
        
        // Check if this strategy can work
        const canUse = await strategy.canCreate()
        if (!canUse) {
          console.log(`❌ Strategy ${strategy.name} not available`)
          continue
        }

        // Check for existing folder first
        const existing = await strategy.findExisting(parentFolderId, liaisonName)
        if (existing) {
          console.log(`✅ Found existing folder with strategy ${strategy.name}:`, existing.name)
          return existing
        }

        // Try to create new folder
        const newFolder = await strategy.create(parentFolderId, liaisonName)
        console.log(`✅ Created folder with strategy ${strategy.name}:`, newFolder.name)
        
        // Store strategy info for future use
        await this.recordSuccessfulStrategy(strategy.name, newFolder.uri)
        
        return newFolder

      } catch (error) {
        console.log(`❌ Strategy ${strategy.name} failed:`, error)
        continue
      }
    }

    throw new Error('All folder organization strategies failed')
  }

  private async testNestedFolderSupport(): Promise<boolean> {
    // Create a test folder to check API capabilities
    try {
      const testResponse = await fetch('https://api.vimeo.com/me/projects/26555277/folders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })
      return testResponse.status !== 404
    } catch {
      return false
    }
  }

  private async createEnhancedFlatFolder(liaisonName: string) {
    const enhancedName = `📁 SSR • ${liaisonName}`
    
    return await fetch('https://api.vimeo.com/me/folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: enhancedName,
        description: `Screen recordings for ${liaisonName} • Auto-organized folder`
      })
    }).then(r => r.json())
  }

  private async findFolderByName(name: string): Promise<any> {
    try {
      const response = await fetch('https://api.vimeo.com/me/folders', {
        headers: {
          'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      return data.data?.find((folder: any) => folder.name === name)
    } catch {
      return null
    }
  }

  private async recordSuccessfulStrategy(strategyName: string, folderUri: string) {
    // Store which strategy worked for future optimization
    console.log(`📝 Recording successful strategy: ${strategyName} for folder: ${folderUri}`)
  }
}
