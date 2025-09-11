import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, email } = req.query

  try {
    // Check if we're looking for a specific user
    if (userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      return res.status(200).json({ profile: data, error })
    }

    if (email) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single()

      return res.status(200).json({ profile: data, error })
    }

    // If no specific user, return all profiles for debugging
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, display_name')
      .order('email')

    return res.status(200).json({ profiles: data, error })
  } catch (error) {
    console.error('Debug user API error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error })
  }
}
