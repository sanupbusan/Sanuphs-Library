import { requireAdminSession } from '@/lib/admin-auth'
import { listAdminOverdueLoans } from '@/lib/admin-overdue'
import { jsonDataWithMeta, runApiRoute, withNoStore } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'FETCH_OVERDUE_LOANS_FAILED',
        message: '연체 목록을 불러오지 못했습니다.',
      },
      logLabel: 'Admin overdue fetch error:',
    },
    async () => {
      const session = await requireAdminSession(request)
      const today = new Date().toISOString().slice(0, 10)
      const overdueLoans = await listAdminOverdueLoans(session.supabase, today)

      return jsonDataWithMeta(
        overdueLoans,
        {
          today,
        },
        withNoStore()
      )
    }
  )
}
