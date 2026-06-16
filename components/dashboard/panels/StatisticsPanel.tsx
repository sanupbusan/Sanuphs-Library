'use client'

import { BarChart3 } from 'lucide-react'
import { DashboardRefreshButton, type DashboardRefreshProps } from '@/components/dashboard/DashboardRefreshButton'
import { StatCard } from '@/components/dashboard/StatCard'
import { formatNumber, type StudentLoanStatistic } from '@/lib/dashboard-data'
import type { DashboardSummary } from '@/lib/library-queries'

type StatisticsPanelProps = {
  summary: DashboardSummary | null
  studentLoanStats: StudentLoanStatistic[]
} & DashboardRefreshProps

export function StatisticsPanel({ summary, studentLoanStats, isRefreshing, onRefresh }: StatisticsPanelProps) {
  const summaryStats = [
    {
      icon: BarChart3,
      label: '전체 책 수',
      value: summary ? formatNumber(summary.total_books) : '-',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: BarChart3,
      label: '대여 중',
      value: summary ? formatNumber(summary.active_loans) : '-',
      color: 'bg-green-50 text-green-600',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">통계</h2>
          <p className="mt-1 text-xs text-gray-500">도서 수와 학생별 대여 권수를 확인하세요</p>
        </div>

        <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {summaryStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">학생별 대여 도서 수</h3>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            기록 {studentLoanStats.length}명
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-50">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-gray-500">학생이름</th>
                <th className="whitespace-nowrap px-4 py-2 text-right text-xs font-medium text-gray-500">빌린 도서 전체 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {studentLoanStats.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">대여 기록이 있는 학생이 없습니다</p>
                        <p className="mt-1 text-xs text-gray-500">대여 기록이 생기면 학생별 전체 권수가 표시됩니다.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {studentLoanStats.map((studentStat) => (
                <tr key={studentStat.id} className="hover:bg-gray-50/60">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-900">
                    {studentStat.studentName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-600">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-800">
                      {studentStat.totalLoansLabel}권
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
