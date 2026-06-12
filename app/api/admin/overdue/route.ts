import { adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { jsonDataWithMeta } from '@/lib/api-route'
import type { OverdueLoanSelectRow } from '@/types/library'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await session.supabase
      .from('loans')
      .select('id, borrowed_on, due_on, books(title), students(name, student_number)')
      .eq('status', 'rented')
      .lt('due_on', today)
      .order('due_on', { ascending: true })
      .limit(100)

    if (error) {
      throw error
    }

    const overdueLoans = ((data ?? []) as unknown as OverdueLoanSelectRow[]).map((loan) => ({
      bookTitle: loan.books?.title ?? null,
      borrowedOn: loan.borrowed_on,
      dueOn: loan.due_on,
      id: loan.id,
      studentName: loan.students?.name ?? null,
      studentNumber: loan.students?.student_number ?? null,
    }))

    return jsonDataWithMeta(overdueLoans, {
      today,
    })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
