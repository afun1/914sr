import { NextRequest, NextResponse } from 'next/server'
import { ensureUserFolder, addVideoToUserFolder } from '@/lib/folder-manager'
import { fetchSparkyFolderVideos } from '@/lib/vimeo-sparky'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, userEmail, displayName, folderName } = body

    if (!action) {
      return NextResponse.json({ error: 'Action parameter required' }, { status: 400 })
    }

    // CRITICAL: Setup all users to prevent folder chaos
    if (action === 'setup-all-users') {
      console.log('🚨 Starting mass user setup to prevent folder chaos...')
      
      try {
        // Get all users from Supabase
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('*')
        
        if (usersError) {
          console.error('Error fetching users:', usersError)
          return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
        }

        if (!users || users.length === 0) {
          return NextResponse.json({ 
            success: true, 
            usersProcessed: 0,
            foldersCreated: 0,
            message: 'No users found to setup' 
          })
        }

        let foldersCreated = 0
        let videosOrganized = 0
        const processedUsers = []

        // Process each user
        for (const user of users) {
          try {
            console.log(`Setting up user: ${user.display_name || user.email}`)
            
            const userFolderName = `${user.display_name || user.email.split('@')[0]} - Screen Recordings`
            
            // Create Vimeo folder
            const folderResponse = await fetch('https://api.vimeo.com/me/projects', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: userFolderName,
                description: `Screen recordings folder for ${user.display_name || user.email}`
              })
            })

            if (folderResponse.ok) {
              const folderData = await folderResponse.json()
              console.log(`✅ Created folder for ${user.display_name}: ${folderData.name}`)
              foldersCreated++

              // Add to user tracking system  
              try {
                const { error: insertError } = await supabase
                  .from('users')
                  .upsert({
                    email: user.email,
                    display_name: user.display_name || user.email.split('@')[0],
                    vimeo_folder_id: folderData.uri.split('/').pop(),
                    folder_name: userFolderName,
                    created_at: new Date().toISOString(),
                    is_setup: true
                  })
                
                if (insertError) {
                  console.error('Error updating user database:', insertError)
                }
              } catch (dbError) {
                console.error('Database error:', dbError)
              }
              
              processedUsers.push({
                email: user.email,
                name: user.display_name,
                folderId: folderData.uri.split('/').pop()
              })
            } else {
              console.log(`⚠️  Folder might already exist for ${user.display_name}`)
              // Still track as processed
              processedUsers.push({
                email: user.email,
                name: user.display_name,
                folderId: null,
                note: 'Folder already exists or creation failed'
              })
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300))
            
          } catch (userError) {
            console.error(`Error setting up user ${user.email}:`, userError)
            // Continue with other users
          }
        }

        console.log(`🎯 Mass setup complete: ${foldersCreated} folders created for ${processedUsers.length} users`)

        return NextResponse.json({
          success: true,
          usersProcessed: processedUsers.length,
          foldersCreated,
          videosOrganized,
          processedUsers
        })

      } catch (error) {
        console.error('❌ Mass setup failed:', error)
        return NextResponse.json({ 
          error: 'Mass setup failed: ' + (error instanceof Error ? error.message : 'Unknown error')
        }, { status: 500 })
      }
    }

    if (action === 'setup-nicolaas') {
      console.log('🎉 Setting up Nicolaas folder and importing his video...')
      
      // 1. Create Nicolaas's folder
      const nicolaasEmail = 'nicolaas.phg@gmail.com' // Update if different
      const folder = await ensureUserFolder(nicolaasEmail, 'Nicolaas')
      
      // 2. Fetch all videos from Sparky Screen Recordings to find his
      const sparkyVideos = await fetchSparkyFolderVideos()
      const nicolaasVideo = sparkyVideos.find((video: any) => 
        video.title.toLowerCase().includes('nicolaas') ||
        video.description?.toLowerCase().includes('nicolaas')
      )
      
      if (nicolaasVideo) {
        // 3. Import his existing video into his folder
        await addVideoToUserFolder(nicolaasEmail, {
          vimeoId: nicolaasVideo.vimeoId,
          title: nicolaasVideo.title,
          description: nicolaasVideo.description,
          thumbnail: nicolaasVideo.thumbnail,
          duration: nicolaasVideo.duration,
          playerUrl: nicolaasVideo.playerUrl,
          createdAt: nicolaasVideo.createdAt,
          userDisplayName: 'Nicolaas'
        })
        
        console.log('✅ Nicolaas video imported into his folder!')
      }
      
      return NextResponse.json({
        success: true,
        message: 'Nicolaas folder created and video imported!',
        folder: folder,
        videoImported: !!nicolaasVideo
      })
    }
    
    if (action === 'create-user-folder') {
      console.log(`🗂️ Creating folder for user: ${displayName} (${userEmail})`)
      
      // Step 1: Create Vimeo project/folder for the user
      const vimeoResponse = await fetch('https://api.vimeo.com/me/projects', {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${displayName} - Screen Recordings`,
          description: `Personal screen recordings folder for ${displayName}`,
          privacy: {
            view: 'nobody'
          }
        })
      })
      
      if (!vimeoResponse.ok) {
        const errorText = await vimeoResponse.text()
        throw new Error(`Vimeo API error: ${vimeoResponse.status} - ${errorText}`)
      }
      
      const vimeoProject = await vimeoResponse.json()
      const projectId = vimeoProject.uri.split('/').pop()
      
      console.log(`✅ Created Vimeo folder: ${vimeoProject.name} (ID: ${projectId})`)
      
      // Step 2: Check if user exists in database, if not create them
      let { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single()
      
      if (userError && userError.code === 'PGRST116') {
        // User doesn't exist, create them
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([
            {
              email: userEmail,
              display_name: displayName,
              vimeo_folder_id: projectId,
              folder_name: `${displayName} - Screen Recordings`,
              created_at: new Date().toISOString()
            }
          ])
          .select()
          .single()
        
        if (createError) {
          throw new Error(`Database error creating user: ${createError.message}`)
        }
        
        user = newUser
        console.log(`✅ Created user in database: ${displayName}`)
      } else if (userError) {
        throw new Error(`Database error: ${userError.message}`)
      } else {
        // User exists, update their folder info
        const { error: updateError } = await supabase
          .from('users')
          .update({
            vimeo_folder_id: projectId,
            folder_name: `${displayName} - Screen Recordings`,
            display_name: displayName
          })
          .eq('email', userEmail)
        
        if (updateError) {
          throw new Error(`Database error updating user: ${updateError.message}`)
        }
        
        console.log(`✅ Updated existing user: ${displayName}`)
      }
      
      // Step 3: Look for videos in main folder that belong to this user
      const mainFolderResponse = await fetch('https://api.vimeo.com/me/projects?per_page=100', {
        headers: {
          'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      })
      
      if (!mainFolderResponse.ok) {
        throw new Error('Could not fetch main folder')
      }
      
      const projects = await mainFolderResponse.json()
      const mainFolder = projects.data.find((p: any) => 
        p.name.toLowerCase() === 'sparky screen recordings'
      )
      
      let videosImported = 0
      
      if (mainFolder) {
        // Get videos from main folder
        const videosResponse = await fetch(`https://api.vimeo.com/me/projects/${mainFolder.uri.split('/').pop()}/videos?per_page=100`, {
          headers: {
            'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        })
        
        if (videosResponse.ok) {
          const videosData = await videosResponse.json()
          
          // Filter videos that belong to this user (by title containing their name or email)
          const userVideos = videosData.data.filter((video: any) => {
            const title = video.name.toLowerCase()
            const emailLower = userEmail.toLowerCase()
            const nameLower = displayName.toLowerCase()
            
            return title.includes(emailLower) || 
                   title.includes(nameLower) ||
                   title.includes(userEmail.split('@')[0].toLowerCase())
          })
          
          // Move user's videos to their personal folder
          for (const video of userVideos) {
            try {
              const addResponse = await fetch(`https://api.vimeo.com/me/projects/${projectId}/videos/${video.uri.split('/').pop()}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                  'Accept': 'application/vnd.vimeo.*+json;version=3.4'
                }
              })
              
              if (addResponse.ok) {
                videosImported++
                console.log(`📹 Moved video to ${displayName}'s folder: ${video.name}`)
              }
            } catch (error) {
              console.log(`Could not move video ${video.name}:`, error)
            }
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Successfully created folder for ${displayName}`,
        user: user,
        vimeoFolderId: projectId,
        folderName: `${displayName} - Screen Recordings`,
        videosImported: videosImported
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('❌ Error in folder setup:', error)
    return NextResponse.json(
      { error: 'Failed to setup folders' },
      { status: 500 }
    )
  }
}