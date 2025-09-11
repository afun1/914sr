import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, email, role = 'user', displayName } = req.body

  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required' })
  }

  try {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      return res.status(200).json({ 
        message: 'Profile already exists', 
        profile: existingProfile 
      })
    }

    // Create new profile
    const newProfile = {
      id: userId,
      email: email,
      role: role,
      display_name: displayName || email.split('@')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select()
      .single()

    if (error) {
      console.error('Create profile error:', error)
      return res.status(500).json({ error: 'Failed to create profile', details: error })
    }

    return res.status(201).json({ 
      message: 'Profile created successfully', 
      profile: data 
    })

  } catch (error) {
    console.error('Create profile API error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error })
  }
}
