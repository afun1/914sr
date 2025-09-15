// filepath: c:\sr97\src\app\api\auth\me\route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Mock user data for now - replace with actual auth logic
  return NextResponse.json({
    id: 'a9a012ca-d0ad-4b6c-8848-7ad898e7b19b',
    email: 'john@tpnlife.com',
    display_name: 'John Bradshaw',
    role: 'admin'
  })
}