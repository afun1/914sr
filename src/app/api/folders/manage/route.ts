import { NextRequest, NextResponse } from 'next/server'
import { ensureUserFolder, addVideoToUserFolder } from '@/lib/folder-manager'

export async function POST(request: NextRequest) {
  try {
    const { userEmail, displayName, action } = await request.json()
    
    if (action === 'create-folder') {
      console.log(`🆕 Creating folder for ${userEmail}`)
      
      const folder = await ensureUserFolder(userEmail, displayName)
      
      return NextResponse.json({
        success: true,
        message: `Folder created for ${displayName || userEmail}`,
        folder: folder
      })
    }
    
    if (action === 'create-nicolaas-folder') {
      console.log('🆕 Creating folder for Nicolaas specifically...')
      
      // Update with Nicolaas's actual email from the Vimeo logs
      const nicolaasEmail = 'nicolaas.phg@gmail.com' // or whatever his actual email is
      const folder = await ensureUserFolder(nicolaasEmail, 'Nicolaas')
      
      return NextResponse.json({
        success: true,
        message: 'Folder created for Nicolaas',
        folder: folder
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('❌ Error in folder management:', error)
    return NextResponse.json(
      { error: 'Failed to manage folder' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userEmail = url.searchParams.get('userEmail')
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 })
    }
    
    const { getUserFolderWithVideos } = await import('@/lib/folder-manager')
    const folderData = await getUserFolderWithVideos(userEmail)
    
    return NextResponse.json({
      success: true,
      folder: folderData
    })
    
  } catch (error) {
    console.error('❌ Error fetching user folder:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user folder' },
      { status: 500 }
    )
  }
}