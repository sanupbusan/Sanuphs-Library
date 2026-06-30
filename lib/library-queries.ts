import 'server-only'

import type { DbClient } from '@/lib/db'
import type {
  DashboardOverdueLoan,
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

export async function getDashboardSummary(client: DbClient): Promise<DashboardSummary> {
  const { rows } = await client.query<DashboardSummary>(
    'select * from public.dashboard_summary limit 1'
  )

  return rows[0] ?? {
    active_loans: 0,
    available_copies: 0,
    overdue_loans: 0,
    total_books: 0,
    total_copies: 0,
  }
}

export async function getRecentLoans(client: DbClient, limit = 5): Promise<RecentLoan[]> {
  const { rows } = await client.query<RecentLoan>(
    `
      select *
      from public.dashboard_recent_loans
      order by rental_date desc
      limit $1
    `,
    [limit]
  )

  return rows
}

export async function getRecentBooks(client: DbClient, limit = 5): Promise<RecentBook[]> {
  const { rows } = await client.query<RecentBook>(
    `
      select id, title, author, category, available_copies, total_copies, created_at
      from public.books
      order by created_at desc
      limit $1
    `,
    [limit]
  )

  return rows
}

export async function getStudentLoanStats(client: DbClient): Promise<StudentLoanStat[]> {
  const { rows } = await client.query<StudentLoanStat>(
    `
      select
        loans.student_id,
        coalesce(students.name, '-') as student_name,
        count(loans.id)::integer as total_loans
      from public.loans
      left join public.students on students.id = loans.student_id
      group by loans.student_id, students.name
    `
  )

  return rows.sort((a, b) => {
    if (a.total_loans !== b.total_loans) {
      return b.total_loans - a.total_loans
    }

    return a.student_name.localeCompare(b.student_name, 'ko-KR')
  })
}

export async function getOverdueLoans(client: DbClient, limit = 20): Promise<DashboardOverdueLoan[]> {
  const { rows } = await client.query<DashboardOverdueLoan>(
    `
      select
        loans.id,
        loans.due_on,
        coalesce(students.name, '-') as student_name
      from public.loans
      left join public.students on students.id = loans.student_id
      where loans.status = 'rented'
        and loans.due_on < current_date
      order by loans.due_on asc
      limit $1
    `,
    [limit]
  )

  return rows
}

export async function searchBooks(client: DbClient, query: string, limit?: number): Promise<SearchBook[]> {
  const { rows } = await client.query<SearchBook>(
    `
      select *
      from public.search_books($1)
      limit $2
    `,
    [query.trim(), limit ?? null]
  )

  return rows
}

export async function getDashboardData(client: DbClient): Promise<DashboardData> {
  const [summary, recentLoans] = await Promise.all([
    getDashboardSummary(client),
    getRecentLoans(client),
  ])

  return {
    summary,
    recentLoans,
  }
}
