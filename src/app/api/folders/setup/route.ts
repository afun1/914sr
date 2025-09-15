import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { action, userEmail, displayName, folderName } = await request.json()
    console.log('🗂️ Creating folder for user:', displayName, '(' + userEmail + ')')

    const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN
    if (!VIMEO_ACCESS_TOKEN) {
      throw new Error('Vimeo access token not configured')
    }

    if (action === 'create-user-folder') {
      // Create folder name
      const finalFolderName = folderName || `${displayName} - Screen Recordings`
      console.log('📁 Creating Vimeo folder:', finalFolderName)

      // Create folder on Vimeo with proper headers - simplified request
      const vimeoResponse = await fetch('https://api.vimeo.com/me/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        },
        body: JSON.stringify({
          name: finalFolderName
        })
      })

      console.log('📡 Vimeo folder creation response:', vimeoResponse.status)

      if (!vimeoResponse.ok) {
        const errorText = await vimeoResponse.text()
        console.log('❌ Vimeo folder creation error:', errorText)
        throw new Error(`Vimeo API error: ${vimeoResponse.status} - ${errorText}`)
      }

      const vimeoProject = await vimeoResponse.json()
      console.log('✅ Vimeo folder created:', vimeoProject.name, 'ID:', vimeoProject.uri?.split('/').pop())

      // Save to database if user info provided
      if (userEmail && displayName) {
        try {
          const { error: insertError } = await supabase
            .from('user_folders')
            .insert({
              user_email: userEmail,
              display_name: displayName,
              folder_name: finalFolderName,
              vimeo_folder_id: vimeoProject.uri?.split('/').pop(),
              created_at: new Date().toISOString()
            })

          if (insertError) {
            console.log('⚠️ Database insert warning (continuing):', insertError)
          } else {
            console.log('✅ User folder saved to database')
          }
        } catch (dbError) {
          console.log('⚠️ Database error (continuing):', dbError)
        }
      }

      return NextResponse.json({
        success: true,
        folderName: finalFolderName,
        folderId: vimeoProject.uri?.split('/').pop(),
        videosImported: 0
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('❌ Error in folder setup:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to setup folders' 
    }, { status: 500 })
  }
}