'use client'

export default function Debug() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Environment Variables</h1>
      <div className="space-y-2">
        <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING'}</p>
        <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING'}</p>
        <p><strong>VIMEO_ACCESS_TOKEN:</strong> {process.env.VIMEO_ACCESS_TOKEN ? 'PRESENT' : 'MISSING'}</p>
      </div>
    </div>
  )
}
