import { requireAdminSession } from '@/lib/admin-auth'
import { getTodayDateKey } from '@/lib/shared/date'
import { listAdminOverdueLoans } from '@/services/loan.service'
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
      const today = getTodayDateKey()
      const overdueLoans = await listAdminOverdueLoans(session.db, today)

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
