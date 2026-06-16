import { clearAdminSessionCookie } from '@/lib/admin-auth'
import { jsonData, runApiRoute } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

export async function POST() {
  return runApiRoute(
    {
      fallback: {
        code: 'ADMIN_LOGOUT_FAILED',
        message: '로그아웃에 실패했습니다.',
      },
      logLabel: 'Admin logout error:',
    },
    async () => {
      const response = jsonData({ ok: true })
      clearAdminSessionCookie(response)

      return response
    }
  )
}
