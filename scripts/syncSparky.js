#!/usr/bin/env node
/* scripts/syncSparky.js

Polls the app's /api/vimeo/folders endpoint to find the Sparky Screen Recordings folder,
checks each video for a liaison email, and calls the existing PATCH API to persist
liaisonEmail metadata so the main UI will group videos into liaison folders on refresh.

Usage:
  node scripts/syncSparky.js        # runs in daemon mode, checks every 60s
  node scripts/syncSparky.js --once # runs one check then exits

Set BASE_URL environment var if your app isn't running on http://localhost:3000
*/

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const INTERVAL_MS = 60 * 1000

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig

async function runOnce() {
  try {
    console.log(new Date().toISOString(), 'Checking for Sparky Screen Recording videos...')
    const foldersRes = await fetch(`${BASE_URL}/api/vimeo/folders`)
    if (!foldersRes.ok) {
      console.warn('Failed to fetch folders:', foldersRes.status)
      return
    }

    const json = await foldersRes.json()
    const all = json.folders || []
    const sparky = all.find(f => /sparky.*screen.*recording/i.test((f.name || '').toLowerCase()))
    if (!sparky) {
      console.log('No Sparky Screen Recordings folder found')
      return
    }

    const videos = sparky.videos || []
    console.log('Found', videos.length, 'videos in Sparky folder')

    for (const v of videos) {
      const vidUri = v.uri || ''
      const vidId = vidUri.split('/').pop()
      if (!vidId) continue

      const desc = (v.description || '')
      // find emails in description
      const foundEmails = (desc.match(emailRegex) || []).map(e => e.toLowerCase())

      // attempt to pull the customer email to avoid clobbering it
      const customerEmailMatch = desc.match(/Email: ([^\n\r]+?)(?:\s+Liaison:|$)/i)
      const customerEmail = customerEmailMatch ? (customerEmailMatch[1] || '').toLowerCase().trim() : ''

      // prefer an email that isn't the customer email
      const liaisonEmail = foundEmails.find(e => e && e !== customerEmail) || ''

      // if we already have liaisonEmail property on video, skip
      const already = (v.liaisonEmail || '')
      if (!liaisonEmail) {
        if (already) {
          // nothing to do
          continue
        }
        // no liaison email found in description or props
        continue
      }

      if (already && already.toLowerCase() === liaisonEmail.toLowerCase()) {
        // already set
        continue
      }

      // Persist liaisonEmail via API PATCH
      try {
        console.log(`Updating video ${vidId} with liaisonEmail=${liaisonEmail}`)
        const patchRes = await fetch(`${BASE_URL}/api/vimeo/videos?update=${encodeURIComponent(vidId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liaisonEmail })
        })
        if (!patchRes.ok) {
          const text = await patchRes.text()
          console.warn('Patch failed for', vidId, patchRes.status, text.substring(0,200))
        } else {
          console.log('Patched', vidId)
        }
      } catch (err) {
        console.error('Error patching video', vidId, err)
      }
    }
  } catch (err) {
    console.error('Sync error', err)
  }
}

async function main() {
  const once = process.argv.includes('--once')
  if (once) {
    await runOnce()
    process.exit(0)
  }

  await runOnce()
  setInterval(runOnce, INTERVAL_MS)
}

main().catch(err => { console.error(err); process.exit(1) })
