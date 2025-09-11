import { VimeoFolder, FolderOrganizationConfig, FolderStrategy, FolderCreationResult, ApiResponse } from './types'
import { NestedFolderStrategy } from './strategies/NestedFolderStrategy'
import { VirtualPathStrategy } from './strategies/VirtualPathStrategy'
import { EnhancedFlatStrategy } from './strategies/EnhancedFlatStrategy'
import { ShowcaseStrategy } from './strategies/ShowcaseStrategy'

/**
 * Advanced Vimeo Folder Manager
 * 
 * This library provides intelligent folder organization for Vimeo with multiple strategies:
 * 1. True nested folders (if supported by account)
 * 2. Virtual path naming for hierarchy simulation
 * 3. Enhanced flat structure with visual grouping
 * 4. Showcase/Collection-based organization
 * 
 * Features:
 * - Automatic strategy detection and fallback
 * - Existing folder detection across naming patterns
 * - Robust error handling and retry logic
 * - Caching for performance
 * - TypeScript support
 */
export class VimeoFolderManager {
  private accessToken: string
  private config: FolderOrganizationConfig
  private strategies: FolderStrategy[]
  private folderCache: Map<string, VimeoFolder> = new Map()
  private strategyCache: Map<string, boolean> = new Map()

  constructor(config: FolderOrganizationConfig) {
    this.config = config
    this.accessToken = config.accessToken
    this.strategies = this.initializeStrategies()
  }

  /**
   * Main method to create or find an organized folder
   */
  async createOrganizedFolder(
    parentFolderId: string, 
    folderName: string, 
    options?: { 
      forceStrategy?: string
      skipCache?: boolean 
    }
  ): Promise<FolderCreationResult> {
    console.log(`🚀 VimeoFolderManager: Creating organized folder "${folderName}"`)

    // Check cache first (unless skipped)
    if (!options?.skipCache) {
      const cacheKey = `${parentFolderId}:${folderName}`
      const cached = this.folderCache.get(cacheKey)
      if (cached) {
        console.log('📂 Found cached folder:', cached.name)
        return {
          folder: cached,
          strategy: 'cache',
          wasExisting: true,
          createdAt: new Date()
        }
      }
    }

    // Try strategies in order of priority
    const strategiesToTry = options?.forceStrategy 
      ? this.strategies.filter(s => s.name === options.forceStrategy)
      : this.strategies.sort((a, b) => a.priority - b.priority)

    for (const strategy of strategiesToTry) {
      try {
        console.log(`🧪 Trying strategy: ${strategy.name}`)

        // Check if strategy is viable (with caching)
        const cacheKey = `strategy:${strategy.name}`
        let canUse = this.strategyCache.get(cacheKey)
        
        if (canUse === undefined) {
          canUse = await strategy.canCreate(this.config)
          this.strategyCache.set(cacheKey, canUse)
        }

        if (!canUse) {
          console.log(`❌ Strategy ${strategy.name} not viable`)
          continue
        }

        // Look for existing folder
        const existing = await strategy.findExisting(parentFolderId, folderName, this.config)
        if (existing) {
          console.log(`✅ Found existing folder with ${strategy.name}:`, existing.name)
          
          // Cache the result
          this.cacheFolder(parentFolderId, folderName, existing)
          
          return {
            folder: existing,
            strategy: strategy.name,
            wasExisting: true,
            createdAt: new Date()
          }
        }

        // Create new folder
        const newFolder = await strategy.create(parentFolderId, folderName, this.config)
        console.log(`✅ Created folder with ${strategy.name}:`, newFolder.name)

        // Cache the result
        this.cacheFolder(parentFolderId, folderName, newFolder)

        return {
          folder: newFolder,
          strategy: strategy.name,
          wasExisting: false,
          createdAt: new Date()
        }

      } catch (error) {
        console.log(`❌ Strategy ${strategy.name} failed:`, error)
        
        // Mark strategy as unusable for a while
        this.strategyCache.set(`strategy:${strategy.name}`, false)
        continue
      }
    }

    throw new Error(`All folder organization strategies failed for "${folderName}"`)
  }

  /**
   * Search for folders across the account
   */
  async searchFolders(searchTerm: string, options?: { includeSubfolders?: boolean }): Promise<VimeoFolder[]> {
    try {
      const response = await this.makeApiRequest('/me/folders')
      const folders = response.data || []
      
      return folders.filter((folder: VimeoFolder) => 
        folder.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  }

  /**
   * Get folder hierarchy information
   */
  async getFolderHierarchy(folderId: string): Promise<{ folder: VimeoFolder, path: string[] }> {
    const folder = await this.getFolder(folderId)
    // TODO: Implement hierarchy traversal
    return {
      folder,
      path: [folder.name]
    }
  }

  /**
   * Bulk organize existing videos into folders
   */
  async organizeExistingVideos(organizationRules: { 
    [pattern: string]: string 
  }): Promise<{ moved: number, errors: number }> {
    // TODO: Implement bulk organization
    return { moved: 0, errors: 0 }
  }

  // Private methods

  private initializeStrategies(): FolderStrategy[] {
    return [
      new NestedFolderStrategy(),
      new VirtualPathStrategy(),
      new EnhancedFlatStrategy(),
      new ShowcaseStrategy()
    ]
  }

  private cacheFolder(parentId: string, folderName: string, folder: VimeoFolder): void {
    const cacheKey = `${parentId}:${folderName}`
    this.folderCache.set(cacheKey, folder)
    
    // Set cache expiration
    setTimeout(() => {
      this.folderCache.delete(cacheKey)
    }, this.config.retryOptions?.retryDelay || 300000) // 5 minutes default
  }

  private async makeApiRequest(endpoint: string, options?: RequestInit): Promise<ApiResponse> {
    const url = `https://api.vimeo.com${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
        ...options?.headers
      }
    })

    if (!response.ok) {
      throw new Error(`Vimeo API Error (${response.status}): ${response.statusText}`)
    }

    return (await response.json()) as ApiResponse
  }

  private async getFolder(folderId: string): Promise<VimeoFolder> {
    const response = await this.makeApiRequest(`/folders/${folderId}`)
    return response as VimeoFolder
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.folderCache.clear()
    this.strategyCache.clear()
  }

  /**
   * Get strategy performance statistics
   */
  getStrategyStats(): { [strategyName: string]: { viable: boolean, lastTested: Date } } {
    const stats: any = {}
    
    for (const strategy of this.strategies) {
      stats[strategy.name] = {
        viable: this.strategyCache.get(`strategy:${strategy.name}`) || false,
        lastTested: new Date() // TODO: Track actual test times
      }
    }
    
    return stats
  }
}
