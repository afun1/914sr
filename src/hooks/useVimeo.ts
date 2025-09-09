import { useState, useCallback } from 'react'

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

export interface UseVimeoReturn {
  videos: VimeoVideo[]
  loading: boolean
  error: string | null
  uploadProgress: number
  fetchVideos: (page?: number, perPage?: number) => Promise<void>
  uploadVideo: (file: File, onProgress?: (progress: number) => void) => Promise<string>
  uploadVideoForUser: (file: File, customerName: string, customerEmail: string, userDisplayName: string, title?: string, description?: string, onProgress?: (progress: number) => void) => Promise<string>
  updateVideo: (videoId: string, updates: Partial<{ name: string, description: string, privacy: any }>) => Promise<void>
  deleteVideo: (videoId: string) => Promise<void>
  getVideo: (videoId: string) => Promise<VimeoVideo>
  createUserFolder: (userDisplayName: string, userEmail: string) => Promise<any>
}

export function useVimeo(): UseVimeoReturn {
  const [videos, setVideos] = useState<VimeoVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fetchVideos = useCallback(async (page = 1, perPage = 25) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/vimeo?action=list&page=${page}&perPage=${perPage}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos')
      }
      
      const data = await response.json()
      setVideos(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadVideo = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    setLoading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Step 1: Get upload ticket
      const ticketResponse = await fetch('/api/vimeo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload-ticket',
          fileSize: file.size,
          fileName: file.name
        })
      })

      if (!ticketResponse.ok) {
        throw new Error('Failed to get upload ticket')
      }

      const ticket = await ticketResponse.json()

      // Step 2: Upload file using TUS protocol
      const xhr = new XMLHttpRequest()
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(progress)
            onProgress?.(progress)
          }
        })

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Complete the upload
              await fetch(ticket.upload.complete_uri, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_VIMEO_ACCESS_TOKEN}`
                }
              })

              const videoId = ticket.uri.split('/').pop()
              resolve(videoId)
            } catch (err) {
              reject(err)
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'))
        })

        xhr.open('PATCH', ticket.upload.upload_link)
        xhr.setRequestHeader('Tus-Resumable', '1.0.0')
        xhr.setRequestHeader('Upload-Offset', '0')
        xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')
        xhr.send(file)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }, [])

  const updateVideo = useCallback(async (videoId: string, updates: Partial<{ name: string, description: string, privacy: any }>) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/vimeo?videoId=${videoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update video')
      }

      // Refresh videos list
      await fetchVideos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchVideos])

  const deleteVideo = useCallback(async (videoId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/vimeo?videoId=${videoId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete video')
      }

      // Refresh videos list
      await fetchVideos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchVideos])

  const uploadVideoForUser = useCallback(async (
    file: File, 
    customerName: string, 
    customerEmail: string,
    userDisplayName: string,
    title?: string,
    description?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    setLoading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Step 1: Get user-specific upload ticket with customer metadata
      const ticketResponse = await fetch('/api/vimeo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload-ticket-user',
          userFileSize: file.size,
          userFileName: file.name,
          customerName,
          customerEmail,
          userDisplayName,
          title,
          description
        })
      })

      if (!ticketResponse.ok) {
        throw new Error('Failed to get user upload ticket')
      }

      const ticket = await ticketResponse.json()

      // Step 2: Upload file using TUS protocol
      const xhr = new XMLHttpRequest()
      
      const videoId = await new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(progress)
            onProgress?.(progress)
          }
        })

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Complete the upload
              await fetch(ticket.upload.complete_uri, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_VIMEO_ACCESS_TOKEN}`
                }
              })

              const videoId = ticket.uri.split('/').pop()
              resolve(videoId)
            } catch (err) {
              reject(err)
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'))
        })

        xhr.open('PATCH', ticket.upload.upload_link)
        xhr.setRequestHeader('Tus-Resumable', '1.0.0')
        xhr.setRequestHeader('Upload-Offset', '0')
        xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')
        xhr.send(file)
      })

      // Step 3: Move video to folder if folder info is available
      if (ticket.folderUri) {
        try {
          console.log('Moving video to folder:', ticket.folderName)
          await fetch('/api/vimeo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'move-video-to-folder',
              videoUri: ticket.uri,
              folderUri: ticket.folderUri
            })
          })
          console.log('Video moved to folder successfully')
        } catch (moveError) {
          console.error('Failed to move video to folder:', moveError)
          // Don't fail the upload if folder move fails
        }
      }

      return videoId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }, [])

  const createUserFolder = useCallback(async (userDisplayName: string, userEmail: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/vimeo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-user-folder',
          userDisplayName,
          userEmail
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create user folder')
      }

      return response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getVideo = useCallback(async (videoId: string): Promise<VimeoVideo> => {
    const response = await fetch(`/api/vimeo?action=get&videoId=${videoId}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch video')
    }
    
    return response.json()
  }, [])

  return {
    videos,
    loading,
    error,
    uploadProgress,
    fetchVideos,
    uploadVideo,
    uploadVideoForUser,
    updateVideo,
    deleteVideo,
    getVideo,
    createUserFolder
  }
}
