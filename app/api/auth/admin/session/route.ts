import { NextResponse } from 'next/server'
import {
  adminAuthErrorResponse,
  requireAdminSession,
  serializeAdminSession,
} from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)

    return NextResponse.json({
      data: serializeAdminSession(session),
    })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
