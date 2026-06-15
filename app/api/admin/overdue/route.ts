import { adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { listAdminOverdueLoans } from '@/lib/admin-overdue'
import { jsonDataWithMeta } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const today = new Date().toISOString().slice(0, 10)
    const overdueLoans = await listAdminOverdueLoans(session.supabase, today)

    return jsonDataWithMeta(overdueLoans, {
      today,
    })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
