import { sql } from 'drizzle-orm'
import type { DbClient } from '@/lib/db'
import type { DashboardSummary, RecentLoan } from '@/types/library'

export async function getDashboardSummary(db: DbClient): Promise<DashboardSummary> {
  const result = await db.execute<DashboardSummary>(
    sql`select * from public.get_backend_dashboard_summary()`
  )

  return result.rows[0] ?? {
    active_loans: 0,
    available_copies: 0,
    overdue_loans: 0,
    total_books: 0,
    total_copies: 0,
  }
}

export async function getRecentLoans(db: DbClient, limit: number): Promise<RecentLoan[]> {
  const result = await db.execute<RecentLoan>(
    sql`select * from public.list_backend_dashboard_recent_loans(${limit}::integer)`
  )

  return result.rows
}
