import { NextResponse } from 'next/server'

// This endpoint returns customers using the same logic as your /customers page
// It processes Vimeo videos and extracts customer data just like CustomerManagement.tsx does
export async function GET() {
  try {
    console.log('📋 Fetching customers using same logic as /customers page...')
    
    // Get Vimeo videos first (same as useVimeo.ts)
    const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vimeo access token not configured',
        customers: []
      }, { status: 500 })
    }

    // Fetch videos from all folders (same logic as useVimeo.ts)
    const foldersResponse = await fetch('https://api.vimeo.com/me/projects', {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })

    if (!foldersResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch folders from Vimeo',
        customers: []
      }, { status: 500 })
    }

    const foldersData = await foldersResponse.json()
    const allVideos = []

    // Get videos from all folders
    for (const folder of foldersData.data || []) {
      try {
        const videosResponse = await fetch(`https://api.vimeo.com/me/projects/${folder.uri.split('/').pop()}/videos`, {
          headers: {
            'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        })

        if (videosResponse.ok) {
          const videosData = await videosResponse.json()
          allVideos.push(...(videosData.data || []))
        }
      } catch (error) {
        console.log(`Error fetching videos from folder ${folder.name}:`, error)
      }
    }

    // Extract customer data from videos (same logic as CustomerManagement.tsx)
    const customersMap = new Map()

    for (const video of allVideos) {
      // Extract customer name from video title (format: "Customer Name - Screen Recording...")
      const titleMatch = video.name?.match(/^(.+?)\s*-\s*Screen Recording/)
      if (titleMatch) {
        const customerName = titleMatch[1].trim()
        
        // Extract email from description or generate one
        let customerEmail = ''
        if (video.description) {
          const emailMatch = video.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
          if (emailMatch) {
            customerEmail = emailMatch[1]
          }
        }
        
        // Generate email if not found
        if (!customerEmail) {
          const nameEmailMatch = customerName.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
          if (nameEmailMatch) {
            customerEmail = nameEmailMatch[1]
          } else {
            const cleanName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().replace(/\s+/g, '.')
            customerEmail = `${cleanName}@example.com`
          }
        }
        
        const customerKey = `${customerName}|${customerEmail}`
        if (!customersMap.has(customerKey)) {
          customersMap.set(customerKey, {
            id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: customerName,
            email: customerEmail,
            videoCount: 1,
            lastRecording: video.created_time,
            customerSince: video.created_time,
            videos: [video] // Store actual videos for detailed view later
          })
        } else {
          const existing = customersMap.get(customerKey)
          existing.videoCount++
          existing.videos.push(video)
          if (new Date(video.created_time) > new Date(existing.lastRecording)) {
            existing.lastRecording = video.created_time
          }
          // Keep the earliest date as customerSince
          if (new Date(video.created_time) < new Date(existing.customerSince)) {
            existing.customerSince = video.created_time
          }
        }
      }
    }

    const customers = Array.from(customersMap.values()).sort((a, b) => 
      new Date(b.lastRecording).getTime() - new Date(a.lastRecording).getTime()
    )

    console.log(`✅ Extracted ${customers.length} customers from Vimeo videos`)
    
    return NextResponse.json({
      success: true,
      customers: customers
    })

  } catch (error) {
    console.error('Error fetching customer list:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch customer list',
      customers: []
    }, { status: 500 })
  }
}