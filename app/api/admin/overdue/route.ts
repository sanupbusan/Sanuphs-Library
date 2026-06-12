import { NextResponse } from 'next/server'
import { adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

type OverdueLoanRow = {
  borrowed_on: string
  books: {
    title: string | null
  } | null
  due_on: string
  id: string
  students: {
    name: string | null
    student_number: string | null
  } | null
}

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

    const overdueLoans = ((data ?? []) as unknown as OverdueLoanRow[]).map((loan) => ({
      bookTitle: loan.books?.title ?? null,
      borrowedOn: loan.borrowed_on,
      dueOn: loan.due_on,
      id: loan.id,
      studentName: loan.students?.name ?? null,
      studentNumber: loan.students?.student_number ?? null,
    }))

    return NextResponse.json({
      data: overdueLoans,
      meta: {
        today,
      },
    })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
