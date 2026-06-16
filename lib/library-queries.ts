import type { TypedSupabaseClient } from '@/lib/supabase'
import type {
  ActiveLoanWithStudent,
  DashboardOverdueLoan,
  DashboardOverdueLoanWithStudent,
  DashboardSummary,
  RecentBook,
  RecentLoan,
  SearchBook,
  StudentLoanStat,
} from '@/types/library'

export type {
  DashboardOverdueLoan as OverdueLoan,
  DashboardSummary,
  RecentBook,
  RecentLoan,
  SearchBook,
  StudentLoanStat,
} from '@/types/library'

export type DashboardData = {
  summary: DashboardSummary
  recentLoans: RecentLoan[]
}

export async function getDashboardSummary(client: TypedSupabaseClient) {
  const { data, error } = await client
    .from('dashboard_summary')
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getRecentLoans(client: TypedSupabaseClient, limit = 5) {
  const { data, error } = await client
    .from('dashboard_recent_loans')
    .select('*')
    .order('rental_date', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getRecentBooks(client: TypedSupabaseClient, limit = 5): Promise<RecentBook[]> {
  const { data, error } = await client
    .from('books')
    .select('id, title, author, category, available_copies, total_copies, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getStudentLoanStats(client: TypedSupabaseClient): Promise<StudentLoanStat[]> {
  const { data, error } = await client
    .from('loans')
    .select('id, student_id, students(name)')
    .returns<ActiveLoanWithStudent[]>()

  if (error) {
    throw error
  }

  const statsByStudent = new Map<string, StudentLoanStat>()

  for (const loan of data ?? []) {
    const existingStat = statsByStudent.get(loan.student_id)

    if (existingStat) {
      existingStat.total_loans += 1
      continue
    }

    statsByStudent.set(loan.student_id, {
      student_id: loan.student_id,
      student_name: loan.students?.name ?? '-',
      total_loans: 1,
    })
  }

  return Array.from(statsByStudent.values()).sort((a, b) => {
    if (a.total_loans !== b.total_loans) {
      return b.total_loans - a.total_loans
    }

    return a.student_name.localeCompare(b.student_name, 'ko-KR')
  })
}

export async function getOverdueLoans(client: TypedSupabaseClient, limit = 20): Promise<DashboardOverdueLoan[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await client
    .from('loans')
    .select('id, due_on, students(name)')
    .eq('status', 'rented')
    .lt('due_on', today)
    .order('due_on', { ascending: true })
    .limit(limit)
    .returns<DashboardOverdueLoanWithStudent[]>()

  if (error) {
    throw error
  }

  return (data ?? []).map((loan) => ({
    due_on: loan.due_on,
    id: loan.id,
    student_name: loan.students?.name ?? '-',
  }))
}

export async function searchBooks(client: TypedSupabaseClient, query: string) {
  const { data, error } = await client
    .rpc('search_books', { search_query: query.trim() })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getDashboardData(client: TypedSupabaseClient): Promise<DashboardData> {
  const [summary, recentLoans] = await Promise.all([
    getDashboardSummary(client),
    getRecentLoans(client),
  ])

  return {
    summary,
    recentLoans,
  }
}
