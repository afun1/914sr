#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function timestamp() {
  const d = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function cpRecursive(src, dest) {
  // Prefer fs.cp when available (Node 16.7+)
  try {
    if (fs.promises && typeof fs.promises.cp === 'function') {
      await fs.promises.cp(src, dest, { recursive: true })
      return
    }
  } catch (err) {
    // fall through to manual copy
  }

  // Manual recursive copy fallback
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await cpRecursive(srcPath, destPath)
    } else if (entry.isSymbolicLink()) {
      const link = await fs.promises.readlink(srcPath)
      try { await fs.promises.symlink(link, destPath) } catch (e) { /* ignore */ }
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}

async function main() {
  const src = path.resolve(process.argv[2] || path.join(__dirname, '..')) // default project root c:\sr97
  const destArg = process.argv[3]
  let dest
  if (destArg) {
    dest = path.resolve(destArg)
  } else {
    const parent = path.dirname(src)
    dest = path.join(parent, path.basename(src) + '-backup-' + timestamp())
  }

  console.log('Source:', src)
  console.log('Destination:', dest)

  try {
    await cpRecursive(src, dest)
    console.log('Backup complete')
  } catch (err) {
    console.error('Backup failed:', err)
    process.exit(1)
  }
}

main()
