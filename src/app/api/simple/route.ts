// filepath: c:\sr97\src\app\api\simple\route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Simple API works!' })
}