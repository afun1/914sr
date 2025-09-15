import { NextRequest, NextResponse } from 'next/server'

const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN

export async function GET() {
  try {
    console.log('🔄 Fetching customers from Vimeo folders and videos...')
    
    if (!VIMEO_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Vimeo access token not configured' }, { status: 500 })
    }

    // Get all folders first
    const foldersResponse = await fetch('https://api.vimeo.com/me/projects', {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    })

    if (!foldersResponse.ok) {
      console.error('Failed to fetch folders:', foldersResponse.status)
      return NextResponse.json({ error: 'Failed to fetch folders from Vimeo' }, { status: 500 })
    }

    const foldersData = await foldersResponse.json()
    const customers = new Map()

    // Process each folder
    for (const folder of foldersData.data || []) {
      console.log(`📹 Checking folder: ${folder.name}`)
      
      try {
        // Get videos in this folder
        const videosResponse = await fetch(`https://api.vimeo.com/me/projects/${folder.uri.split('/').pop()}/videos`, {
          headers: {
            'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        })

        if (videosResponse.ok) {
          const videosData = await videosResponse.json()
          
          // Extract customers from video titles
          for (const video of videosData.data || []) {
            console.log(`🎬 Processing video: ${video.name}`)
            
            // Extract customer info from video title format: "Customer Name - Screen Recording..."
            const titleMatch = video.name.match(/^(.+?)\s*-\s*Screen Recording/)
            if (titleMatch) {
              const customerName = titleMatch[1].trim()
              
              // Try to extract email from description
              let customerEmail = ''
              if (video.description) {
                const emailMatch = video.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
                if (emailMatch) {
                  customerEmail = emailMatch[1]
                }
              }
              
              // If no email in description, generate one based on name
              if (!customerEmail) {
                // Check if customer name contains email-like pattern
                const nameEmailMatch = customerName.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
                if (nameEmailMatch) {
                  customerEmail = nameEmailMatch[1]
                } else {
                  // Generate email from name (fallback)
                  const cleanName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().replace(/\s+/g, '.')
                  customerEmail = `${cleanName}@example.com`
                }
              }
              
              const customerKey = `${customerName}|${customerEmail}`
              if (!customers.has(customerKey)) {
                customers.set(customerKey, {
                  name: customerName,
                  email: customerEmail,
                  videoCount: 1,
                  lastRecording: video.created_time
                })
                console.log(`✅ Found customer: ${customerName} ${customerEmail}`)
              } else {
                const existing = customers.get(customerKey)
                existing.videoCount++
                if (new Date(video.created_time) > new Date(existing.lastRecording)) {
                  existing.lastRecording = video.created_time
                }
              }
            }
          }
        }
      } catch (folderError) {
        console.log(`⚠️ Error processing folder ${folder.name}:`, folderError)
      }
    }

    const customerList = Array.from(customers.values()).sort((a, b) => 
      new Date(b.lastRecording).getTime() - new Date(a.lastRecording).getTime()
    )

    console.log(`📋 Extracted customers from folder videos: ${customerList.length} customers`)
    console.log(`✅ Customers loaded from Vimeo folder videos: ${customerList.length} customers`)

    return NextResponse.json({
      success: true,
      customers: customerList,
      total: customerList.length
    })

  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch customers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}