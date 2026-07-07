import { desc } from 'drizzle-orm'
import { dashboardRecentLoans, dashboardSummary } from '@/db/schema'
import type { DbClient } from '@/lib/db'
import type { DashboardSummary, RecentLoan } from '@/types/library'

export async function getDashboardSummary(db: DbClient): Promise<DashboardSummary> {
  const rows = await db.select().from(dashboardSummary).limit(1)
  return rows[0] ?? {
    active_loans: 0,
    available_copies: 0,
    overdue_loans: 0,
    total_books: 0,
    total_copies: 0,
  }
}

export async function getRecentLoans(db: DbClient, limit: number): Promise<RecentLoan[]> {
  return db.select().from(dashboardRecentLoans).orderBy(desc(dashboardRecentLoans.rental_date)).limit(limit)
}
