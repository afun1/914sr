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

  async createFolder(name: string, parentFolderId = '26555277'): Promise<VimeoFolder> {
    // Try to create folder inside the SSR folder first
    try {
      console.log(`Attempting to create folder "${name}" in SSR folder ${parentFolderId}`)
      return await this.makeRequest(`/me/folders`, {
        method: 'POST',
        body: JSON.stringify({ 
          name,
          parent_folder_uri: `/me/folders/${parentFolderId}`
        })
      })
    } catch (error) {
      console.warn(`Failed to create folder in SSR folder, falling back to root level:`, error)
      // Fallback to root level if SSR folder creation fails
      return await this.makeRequest('/me/folders', {
        method: 'POST',
        body: JSON.stringify({ name })
      })
    }
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

  // Creates a folder for a specific liaison (not customer) since customers may work with multiple liaisons
  async createUserSpecificFolder(userDisplayName: string, userEmail: string): Promise<VimeoFolder> {
    try {
      console.log('Creating/finding liaison folder:', userDisplayName)
      
      // Use the existing SSR project (ID: 26555277) directly for all recordings
      const ssrProjectId = '26555277'
      console.log('Using existing SSR folder directly for all recordings:', ssrProjectId)
      
      // Return the SSR folder itself - all videos will go directly into this folder
      // We'll organize by video naming instead of subfolders since Vimeo doesn't support nested folders well
      return {
        uri: `/users/112996063/projects/${ssrProjectId}`,
        name: 'Sparky Screen Recordings',
        created_time: '',
        modified_time: '',
        resource_key: ''
      }
      
    } catch (outerError) {
      console.error('❌ Error in createUserSpecificFolder:', outerError)
      throw outerError
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

  async moveVideoToProjectFolder(videoUri: string, folderUri: string, projectId = '26555277'): Promise<void> {
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

  // Move a folder into another folder
  async moveFolder(sourceFolderId: string, targetFolderId: string): Promise<any> {
    try {
      console.log(`Moving folder ${sourceFolderId} into folder ${targetFolderId}`)
      
      // Try different URI formats
      const uriFormats = [
        `/me/folders/${targetFolderId}`,
        `/folders/${targetFolderId}`,
        `https://api.vimeo.com/me/folders/${targetFolderId}`
      ]
      
      for (const uri of uriFormats) {
        try {
          console.log(`Trying parent_folder_uri format: ${uri}`)
          const result = await this.makeRequest(`/me/folders/${sourceFolderId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              parent_folder_uri: uri
            })
          })
          console.log(`✅ Successfully moved folder with URI format: ${uri}`)
          return result
        } catch (error) {
          console.log(`❌ Failed with URI format ${uri}:`, error)
        }
      }
      
      throw new Error('All URI formats failed for folder moving')
      
    } catch (error) {
      console.error('Error in moveFolder:', error)
      throw error
    }
  }

  // Public method to get all folders for debugging
  async getAllFolders(): Promise<any[]> {
    try {
      const response = await this.makeRequest('/me/folders')
      return response.data || []
    } catch (error) {
      console.error('Error getting folders:', error)
      return []
    }
  }

  // Manual folder organization utility
  async organizeFoldersIntoSSR(): Promise<void> {
    try {
      console.log('Starting folder organization into SSR...')
      
      // Get all folders at root level
      const rootFolders = await this.makeRequest('/me/folders')
      console.log('Found root folders:', rootFolders.data?.length)
      
      // Get existing folders in SSR to avoid duplicates
      const ssrFolderId = '26555277'
      let ssrSubfolders: any[] = []
      
      try {
        const ssrContent = await this.makeRequest(`/me/folders/${ssrFolderId}/folders`)
        ssrSubfolders = ssrContent.data || []
        console.log('Existing SSR subfolders:', ssrSubfolders.length)
      } catch (error) {
        console.log('Could not get SSR subfolders, proceeding anyway:', error)
      }
      
      // Find liaison folders that should be moved (exclude SSR itself)
      const liaisonFolders = rootFolders.data?.filter((folder: any) => {
        const folderId = folder.uri.split('/').pop()
        return folderId !== ssrFolderId && 
               !ssrSubfolders.find(sub => sub.name === folder.name)
      })
      
      console.log('Liaison folders to organize:', liaisonFolders?.length)
      
      // Try to move each liaison folder into SSR
      for (const folder of liaisonFolders || []) {
        const folderId = folder.uri.split('/').pop()
        console.log(`Attempting to move folder "${folder.name}" (${folderId}) into SSR`)
        
        try {
          // Try method 1: PATCH with parent_folder_uri
          await this.makeRequest(`/me/folders/${folderId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              parent_folder_uri: `/me/folders/${ssrFolderId}`
            })
          })
          console.log(`✅ Successfully moved "${folder.name}" into SSR`)
          
        } catch (moveError) {
          console.log(`❌ Failed to move "${folder.name}":`, moveError)
          
          // Try method 2: Different URI format
          try {
            await this.makeRequest(`/me/folders/${folderId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                parent_folder_uri: `/folders/${ssrFolderId}`
              })
            })
            console.log(`✅ Successfully moved "${folder.name}" into SSR (method 2)`)
          } catch (move2Error) {
            console.log(`❌ Method 2 also failed for "${folder.name}":`, move2Error)
          }
        }
      }
      
      console.log('Folder organization complete')
      
    } catch (error) {
      console.error('Error in organizeFoldersIntoSSR:', error)
      throw error
    }
  }
}

export default VimeoService
