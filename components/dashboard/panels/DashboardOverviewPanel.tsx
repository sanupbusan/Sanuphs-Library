'use client'

import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'
import { DashboardRefreshButton, type DashboardRefreshProps } from '@/components/dashboard/DashboardRefreshButton'
import { RecentRentalsTable } from '@/components/dashboard/RecentRentalsTable'
import { StatCard } from '@/components/dashboard/StatCard'
import type { DashboardStat, RecentRental } from '@/lib/dashboard-data'

type DashboardOverviewPanelProps = {
  canViewStatistics: boolean
  isCheckingSession: boolean
  stats: DashboardStat[]
  recentRentals: RecentRental[]
} & DashboardRefreshProps

export function DashboardOverviewPanel({
  canViewStatistics,
  isCheckingSession,
  stats,
  recentRentals,
  isRefreshing,
  onRefresh,
}: DashboardOverviewPanelProps) {
  if (!canViewStatistics) {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">대시보드</h2>
        </div>

        <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-100 bg-white p-6 text-center shadow-sm">
          <div>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {isCheckingSession ? '로그인 상태를 확인하고 있습니다' : '지금 바로 바코드를 찍어 대출, 반납을 하세요'}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              통계와 연체 관리는 관리자 로그인 후 표시됩니다.
            </p>
            {isCheckingSession ? null : (
              <Link
                href="/admin/login"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                로그인하기
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

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
