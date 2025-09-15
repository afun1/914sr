import { NextRequest } from 'next/server'

// Vimeo API configuration
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API_BASE = 'https://api.vimeo.com'

if (!VIMEO_ACCESS_TOKEN) {
  console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables')
}

export async function fetchFolders(request: NextRequest) {
  try {
    console.log('📡 fetchFolders helper called (route.gpt.ts) - fetching specific project videos')

    if (!VIMEO_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: 'Vimeo access token not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    // Target specific team folder: https://vimeo.com/user/112996063/folder/26555277
    const userId = '112996063'
    const projectId = '26555277'

    const headers = {
      Authorization: `Bearer ${VIMEO_ACCESS_TOKEN}`,
      Accept: 'application/vnd.vimeo.*+json;version=3.4'
    }

    // Fetch project metadata (optional - to get the folder name)
    let project: any = {
      uri: `/users/${userId}/projects/${projectId}`,
      name: 'Sparky Screen Recordings',
      link: `https://vimeo.com/user/${userId}/folder/${projectId}`
    }

    try {
      const projectRes = await fetch(`${VIMEO_API_BASE}/users/${userId}/projects/${projectId}`, { headers })
      if (projectRes.ok) {
        const projJson = await projectRes.json()
        project = {
          uri: projJson.uri || project.uri,
          name: projJson.name || project.name,
          link: projJson.link || project.link,
          created_time: projJson.created_time || projJson.created_on || null
        }
      } else {
        console.warn('⚠️ Could not fetch project metadata, using defaults', projectRes.status)
      }
    } catch (err) {
      console.warn('⚠️ Error fetching project metadata, using defaults', err)
    }

    // Fetch videos that belong to this specific project
    const videosRes = await fetch(`${VIMEO_API_BASE}/users/${userId}/projects/${projectId}/videos?per_page=100`, { headers })

    if (!videosRes.ok) {
      const text = await videosRes.text()
      console.error('❌ Failed to fetch videos for project:', videosRes.status, text)
      return new Response(JSON.stringify({ error: 'Failed to fetch Vimeo project videos' }), { status: videosRes.status, headers: { 'Content-Type': 'application/json' } })
    }

    const vidsJson = await videosRes.json()
    const videos = Array.isArray(vidsJson.data) ? vidsJson.data : []

    // Return a single-folder response shaped for the frontend
    const folder = {
      id: project.uri || `/users/${userId}/projects/${projectId}`,
      uri: project.uri || `/users/${userId}/projects/${projectId}`,
      name: project.name || 'Sparky Screen Recordings',
      link: project.link || `https://vimeo.com/user/${userId}/folder/${projectId}`,
      created_time: project.created_time || null,
      videos
    }

    return new Response(JSON.stringify({ success: true, folders: [folder] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('❌ Error in fetchFolders helper:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
