import {
  AdminAuthError,
  requireAdminSession,
  serializeAdminSession,
} from '@/lib/admin-auth'
import { jsonData, runApiRoute, withNoStore } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

const DEBUG_TAG = '[LOGIN_DEBUG_SESSION_API]'
function dbg(msg: string, data?: unknown) {
  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
}

function isOptionalSessionCheck(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('optional') === '1'
}

export async function GET(request: Request) {
  dbg('GET /api/auth/admin/session — ENTERED', {
    url: request.url,
    optional: isOptionalSessionCheck(request),
    hasCookie: request.headers.get('cookie') !== null,
  })

  return runApiRoute(
    {
      fallback: {
        code: 'ADMIN_SESSION_FAILED',
        message: '세션 확인에 실패했습니다.',
      },
      logLabel: 'Admin session check error:',
    },
    async () => {
      try {
        const session = await requireAdminSession(request)
        dbg('GET session: valid session found', { loginId: session.user.loginId })

        return jsonData(serializeAdminSession(session), withNoStore())
      } catch (error) {
        dbg('GET session: requireAdminSession threw', {
          code: (error as AdminAuthError)?.code,
          status: (error as AdminAuthError)?.status,
          optional: isOptionalSessionCheck(request),
        })

        if (isOptionalSessionCheck(request) && error instanceof AdminAuthError && error.status === 401) {
          dbg('GET session: optional check, returning null')
          return jsonData(null, withNoStore())
        }

        throw error
      }
    }
  )
}
