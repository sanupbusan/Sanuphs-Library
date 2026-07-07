import type { DashboardData } from '@/services/dashboard.service'

export type {
  DashboardOverdueLoan as OverdueLoan,
  DashboardSummary,
  RecentBook,
  RecentLoan,
  SearchBook,
  StudentLoanStat,
} from '@/types/library'

export type { DashboardData }

export {
  getDashboardData,
  getOverdueLoans,
  getRecentBooks,
  getStudentLoanStats,
} from '@/services/dashboard.service'

export { searchBooks } from '@/services/public-library.service'
