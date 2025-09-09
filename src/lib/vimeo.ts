export interface VimeoVideo {
  uri: string
  name: string
  description: string
  duration: number
  created_time: string
  modified_time: string
  status: string
  privacy: {
    view: string
    embed: string
  }
  pictures: {
    sizes: Array<{
      width: number
      height: number
      link: string
    }>
  }
  files?: Array<{
    quality: string
    type: string
    width: number
    height: number
    link: string
  }>
  player_embed_url: string
  link: string
}

export interface VimeoFolder {
  uri: string
  name: string
  created_time: string
  modified_time: string
  resource_key: string
  projectUri?: string
}

export interface VimeoUploadResponse {
  uri: string
  name: string
  description: string
  upload: {
    upload_link: string
    complete_uri: string
    approach: string
    size: number
  }
  folderUri?: string
  projectUri?: string
  folderName?: string
}

export class VimeoService {
  private baseUrl = 'https://api.vimeo.com'
  private accessToken: string

  constructor() {
    this.accessToken = process.env.VIMEO_ACCESS_TOKEN!
    if (!this.accessToken) {
      throw new Error('VIMEO_ACCESS_TOKEN environment variable is required')
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`
    
    console.log(`Making Vimeo API request to: ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
        ...options.headers,
      },
    })

    console.log(`Vimeo API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Vimeo API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url,
        errorText
      })
      throw new Error(`Vimeo API Error (${response.status}): ${errorText}`)
    }

    // Handle responses with no body (like 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      console.log('Vimeo API response: 204 No Content - Success')
      return null
    }

    const data = await response.json()
    console.log(`Vimeo API response data:`, data)
    return data
  }

  async testConnection(): Promise<any> {
    return this.makeRequest('/me?fields=name,account')
  }

  async getVideos(page = 1, perPage = 25): Promise<{ data: VimeoVideo[], total: number }> {
    const response = await this.makeRequest(`/me/videos?page=${page}&per_page=${perPage}&fields=uri,name,description,duration,created_time,modified_time,status,privacy,pictures,files,player_embed_url,link`)
    
    return {
      data: response.data || [],
      total: response.total || 0
    }
  }

  async getVideo(videoId: string): Promise<VimeoVideo> {
    return this.makeRequest(`/videos/${videoId}?fields=uri,name,description,duration,created_time,modified_time,status,privacy,pictures,files,player_embed_url,link`)
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.makeRequest(`/videos/${videoId}`, {
      method: 'DELETE'
    })
  }

  async deleteVideos(videoIds: string[]): Promise<void> {
    const deletePromises = videoIds.map(id => this.deleteVideo(id))
    await Promise.all(deletePromises)
  }

  async getFolders(): Promise<{ data: VimeoFolder[], total: number }> {
    const response = await this.makeRequest('/me/folders?fields=uri,name,created_time,modified_time,resource_key')
    
    return {
      data: response.data || [],
      total: response.total || 0
    }
  }

  async createFolder(name: string, parentProjectId = '26524560'): Promise<VimeoFolder> {
    // Create folder inside the SSR project by default
    return this.makeRequest(`/me/projects/${parentProjectId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name })
    })
  }

  async getFolder(folderId: string): Promise<VimeoFolder> {
    return this.makeRequest(`/me/folders/${folderId}?fields=uri,name,created_time,modified_time,resource_key`)
  }

  async getFolderVideos(folderId: string, page = 1, perPage = 25): Promise<{ data: VimeoVideo[], total: number }> {
    const response = await this.makeRequest(`/me/folders/${folderId}/videos?page=${page}&per_page=${perPage}&fields=uri,name,description,duration,created_time,modified_time,status,privacy,pictures,files,player_embed_url,link`)
    
    return {
      data: response.data || [],
      total: response.total || 0
    }
  }

  async addVideoToFolder(folderId: string, videoId: string): Promise<void> {
    await this.makeRequest(`/me/folders/${folderId}/videos/${videoId}`, {
      method: 'PUT'
    })
  }

  async removeVideoFromFolder(folderId: string, videoId: string): Promise<void> {
    await this.makeRequest(`/me/folders/${folderId}/videos/${videoId}`, {
      method: 'DELETE'
    })
  }

  async createUserSpecificFolder(userDisplayName: string, userEmail: string): Promise<VimeoFolder> {
    try {
      console.log('Creating user folder:', userDisplayName)
      
      // Use the existing SSR project folder (ID: 26524560) as parent
      const ssrProjectId = '26524560'
      const parentFolderId = ssrProjectId
      
      // Step 1: Check if customer folder already exists in SSR project
      const customerFolderName = userDisplayName
      
      try {
        // Check existing folders in SSR project
        const subFolders = await this.makeRequest(`/me/projects/${ssrProjectId}/folders`)
        const existingCustomerFolder = subFolders.data?.find((folder: any) => 
          folder.name === customerFolderName
        )
        
        if (existingCustomerFolder) {
          console.log('Found existing customer folder in SSR project:', existingCustomerFolder.name)
          return existingCustomerFolder
        }
      } catch (error) {
        console.log('Could not check existing sub-folders in SSR project, proceeding to create new one')
      }
      
      // Step 2: Create new customer folder inside SSR project
      console.log('Creating customer folder:', customerFolderName, 'inside SSR project')
      const customerFolder = await this.makeRequest(`/me/projects/${ssrProjectId}/folders`, {
        method: 'POST',
        body: JSON.stringify({
          name: customerFolderName
        })
      })
      
      console.log('Created customer folder:', customerFolder)
      return customerFolder
      
    } catch (error) {
      console.error('Error creating user-specific folder:', error)
      throw error
    }
  }

  async moveVideoToFolder(videoUri: string, folderUri: string): Promise<void> {
    const videoId = videoUri.split('/').pop()
    const folderId = folderUri.split('/').pop()
    
    console.log('Moving video', videoId, 'to folder', folderId)
    
    await this.makeRequest(`/me/folders/${folderId}/videos/${videoId}`, {
      method: 'PUT'
    })
  }

  async moveVideoToProjectFolder(videoUri: string, folderUri: string, projectId = '26524560'): Promise<void> {
    const videoId = videoUri.split('/').pop()
    const folderId = folderUri.split('/').pop()
    
    console.log('Moving video', videoId, 'to project folder', folderId, 'in project', projectId)
    
    try {
      await this.makeRequest(`/me/projects/${projectId}/folders/${folderId}/videos/${videoId}`, {
        method: 'PUT'
      })
      console.log('Successfully moved video to project folder')
    } catch (error) {
      console.log('Project folder move failed, trying regular folder move:', error)
      await this.moveVideoToFolder(videoUri, folderUri)
    }
  }

  async createUploadTicket(
    fileSize: number, 
    fileName: string, 
    folderId?: string,
    customMetadata?: {
      customerName?: string
      customerEmail?: string
      description?: string
      title?: string
    }
  ): Promise<VimeoUploadResponse> {
    const uploadData: any = {
      upload: {
        approach: 'tus',
        size: fileSize
      },
      name: customMetadata?.title || fileName,
      description: customMetadata?.description || ''
      // Removed privacy setting due to account restrictions
    }

    if (customMetadata?.customerName) {
      const customerInfo = `
CUSTOMER INFORMATION:
Name: ${customMetadata.customerName}
Email: ${customMetadata.customerEmail || 'Not provided'}

${customMetadata.description || ''}`
      
      uploadData.description = customerInfo.trim()
    }

    if (folderId) {
      // Handle full URIs or just IDs
      if (folderId.startsWith('/folders/') || folderId.startsWith('/users/')) {
        // Full URI provided - use as-is
        uploadData.folder_uri = folderId
      } else {
        // Just an ID provided - construct folder URI
        uploadData.folder_uri = `/folders/${folderId}`
      }
      console.log('Setting folder_uri to:', uploadData.folder_uri)
    }

    return this.makeRequest('/me/videos', {
      method: 'POST',
      body: JSON.stringify(uploadData)
    })
  }
}

export default VimeoService
