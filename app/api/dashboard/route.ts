import { requireAdminSession } from '@/lib/admin-auth'
import {
  getDashboardData,
  getOverdueLoans,
  getRecentBooks,
  getStudentLoanStats,
} from '@/lib/library-queries'
import { jsonData, runApiRoute, withNoStore } from '@/lib/api-route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'DASHBOARD_FETCH_FAILED',
        message: '대시보드 정보를 불러오지 못했습니다.',
      },
      logLabel: 'Dashboard fetch failed:',
    },
    async () => {
      const session = await requireAdminSession(request)
      const [dashboardData, recentBooks, overdueLoans, studentLoanStats] = await Promise.all([
        getDashboardData(session.db),
        getRecentBooks(session.db),
        getOverdueLoans(session.db),
        getStudentLoanStats(session.db),
      ])

      return jsonData(
        {
          overdueLoans,
          recentBooks,
          recentLoans: dashboardData.recentLoans,
          studentLoanStats,
          summary: dashboardData.summary,
        },
        withNoStore()
      )
    }
  )
}
