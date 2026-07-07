import type { DbClient } from '@/lib/db'
import type { DashboardOverdueLoan, DashboardSummary, RecentBook, RecentLoan, StudentLoanStat } from '@/types/library'
import * as bookRepository from '@/repositories/book.repository'
import * as dashboardRepository from '@/repositories/dashboard.repository'
import * as loanRepository from '@/repositories/loan.repository'

export type DashboardData = {
  summary: DashboardSummary
  recentLoans: RecentLoan[]
}

export async function getDashboardData(db: DbClient): Promise<DashboardData> {
  const [summary, recentLoans] = await Promise.all([
    dashboardRepository.getDashboardSummary(db),
    dashboardRepository.getRecentLoans(db, 5),
  ])

  return { summary, recentLoans }
}

export async function getRecentBooks(db: DbClient, limit = 5): Promise<RecentBook[]> {
  return bookRepository.listRecentBooks(db, limit)
}

export async function getOverdueLoans(db: DbClient, limit = 20): Promise<DashboardOverdueLoan[]> {
  return loanRepository.getDashboardOverdueLoans(db, limit)
}

export async function getStudentLoanStats(db: DbClient): Promise<StudentLoanStat[]> {
  const rows = await loanRepository.getStudentLoanStats(db)
  return rows.sort((a, b) => {
    if (a.total_loans !== b.total_loans) {
      return b.total_loans - a.total_loans
    }

    return a.student_name.localeCompare(b.student_name, 'ko-KR')
  })
}
