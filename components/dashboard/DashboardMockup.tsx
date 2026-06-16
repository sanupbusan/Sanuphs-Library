'use client'

import { useState } from 'react'
import { DashboardOverviewPanel } from '@/components/dashboard/panels/DashboardOverviewPanel'
import { BookManagementPanel } from '@/components/dashboard/panels/BookManagementPanel'
import { OverduePanel } from '@/components/dashboard/panels/OverduePanel'
import { StatisticsPanel } from '@/components/dashboard/panels/StatisticsPanel'
import { DashboardSidebar, type DashboardSection } from '@/components/dashboard/DashboardSidebar'
import type { DashboardRefreshProps } from '@/components/dashboard/DashboardRefreshButton'
import type {
  DashboardStat,
  OverdueLoan,
  RecentBook,
  RecentRental,
  StudentLoanStatistic,
} from '@/lib/dashboard-data'
import type { DashboardSummary } from '@/lib/library-queries'

type DashboardMockupProps = {
  summary: DashboardSummary | null
  overdueLoans: OverdueLoan[]
  stats: DashboardStat[]
  recentRentals: RecentRental[]
  recentBooks: RecentBook[]
  studentLoanStats: StudentLoanStatistic[]
} & DashboardRefreshProps

export function DashboardMockup({
  summary,
  overdueLoans,
  stats,
  recentRentals,
  recentBooks,
  studentLoanStats,
  isRefreshing,
  onRefresh,
}: DashboardMockupProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('dashboard')

  return (
    <div className="h-[410px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex h-full">
        <DashboardSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        <div className="flex-1 overflow-hidden p-4">
          {activeSection === 'books' ? (
            <BookManagementPanel books={recentBooks} isRefreshing={isRefreshing} onRefresh={onRefresh} />
          ) : activeSection === 'overdue' ? (
            <OverduePanel overdueLoans={overdueLoans} isRefreshing={isRefreshing} onRefresh={onRefresh} />
          ) : activeSection === 'statistics' ? (
            <StatisticsPanel
              summary={summary}
              studentLoanStats={studentLoanStats}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          ) : (
            <DashboardOverviewPanel
              stats={stats}
              recentRentals={recentRentals}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
    </div>
  )
}
