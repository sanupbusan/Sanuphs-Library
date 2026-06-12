'use client'

import { DashboardRefreshButton, type DashboardRefreshProps } from '@/components/dashboard/DashboardRefreshButton'
import { RecentRentalsTable } from '@/components/dashboard/RecentRentalsTable'
import { StatCard } from '@/components/dashboard/StatCard'
import type { DashboardStat, RecentRental } from '@/lib/dashboard-data'

type DashboardOverviewPanelProps = {
  stats: DashboardStat[]
  recentRentals: RecentRental[]
} & DashboardRefreshProps

export function DashboardOverviewPanel({ stats, recentRentals, isRefreshing, onRefresh }: DashboardOverviewPanelProps) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">대시보드</h2>
        <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <RecentRentalsTable rentals={recentRentals} />
    </>
  )
}
