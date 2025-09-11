// Type definitions for the Vimeo Folder Manager

export interface VimeoFolder {
  uri: string
  name: string
  created_time: string
  modified_time: string
  resource_key: string
  description?: string
  privacy?: {
    view: string
  }
  metadata?: {
    connections?: any
    interactions?: any
  }
}

export interface FolderOrganizationConfig {
  accessToken: string
  parentFolderId?: string
  parentFolderName?: string
  organizationPattern: 'nested' | 'flat' | 'virtual-path' | 'showcase' | 'enhanced-flat'
  namingConvention: {
    prefix?: string
    separator?: string
    useEmoji?: boolean
    customPattern?: string
  }
  fallbackStrategies?: string[]
  retryOptions?: {
    maxRetries: number
    retryDelay: number
  }
}

export interface FolderStrategy {
  name: string
  priority: number
  canCreate(config: FolderOrganizationConfig): Promise<boolean>
  findExisting(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder | null>
  create(parentId: string, childName: string, config: FolderOrganizationConfig): Promise<VimeoFolder>
  validate?(folder: VimeoFolder): Promise<boolean>
}

export interface ApiResponse<T = any> {
  data?: T[]
  total?: number
  page?: number
  per_page?: number
  paging?: {
    next?: string
    previous?: string
    first?: string
    last?: string
  }
}

export interface VimeoApiError extends Error {
  status: number
  statusText: string
  response?: any
}

export interface FolderSearchOptions {
  includeSubfolders?: boolean
  maxDepth?: number
  namingPatterns?: string[]
  useCache?: boolean
  cacheTimeout?: number
}

export interface FolderCreationResult {
  folder: VimeoFolder
  strategy: string
  wasExisting: boolean
  createdAt: Date
  metadata?: {
    parentFolder?: VimeoFolder
    hierarchyLevel?: number
    organizationPattern?: string
  }
}
