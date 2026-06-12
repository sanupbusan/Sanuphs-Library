import { NextResponse } from 'next/server'
import {
  AdminAuthError,
  adminAuthErrorResponse,
  requireAdminSession,
  serializeAdminSession,
} from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function isOptionalSessionCheck(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('optional') === '1'
}

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)

    return NextResponse.json({
      data: serializeAdminSession(session),
    })
  } catch (error) {
    if (isOptionalSessionCheck(request) && error instanceof AdminAuthError && error.status === 401) {
      return NextResponse.json(
        {
          data: null,
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      )
    }

    return adminAuthErrorResponse(error)
  }
}
