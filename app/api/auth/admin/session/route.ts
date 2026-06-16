import {
  AdminAuthError,
  requireAdminSession,
  serializeAdminSession,
} from '@/lib/admin-auth'
import { jsonData, runApiRoute, withNoStore } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

function isOptionalSessionCheck(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('optional') === '1'
}

export async function GET(request: Request) {
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

        return jsonData(serializeAdminSession(session), withNoStore())
      } catch (error) {
        if (isOptionalSessionCheck(request) && error instanceof AdminAuthError && error.status === 401) {
          return jsonData(null, withNoStore())
        }

        throw error
      }
    }
  )
}
