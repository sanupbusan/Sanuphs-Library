'use client'

import { AlertCircle, AlertTriangle } from 'lucide-react'
import { DashboardRefreshButton, type DashboardRefreshProps } from '@/components/dashboard/DashboardRefreshButton'
import type { OverdueLoan } from '@/lib/dashboard-data'

type OverduePanelProps = {
  overdueLoans: OverdueLoan[]
} & DashboardRefreshProps

export function OverduePanel({ overdueLoans, isRefreshing, onRefresh }: OverduePanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">연체 관리</h2>
          <p className="mt-1 text-xs text-gray-500">연철된 학생과 연체 일수를 확인하세요</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />

          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            연체 {overdueLoans.length}건
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">연체 학생 목록</h3>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            오래된 순
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-50">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-gray-500">학생이름</th>
                <th className="whitespace-nowrap px-4 py-2 text-right text-xs font-medium text-gray-500">연체 일수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {overdueLoans.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">현재 연첼된 학생이 없습니다</p>
                        <p className="mt-1 text-xs text-gray-500">반납 예정일이 지나면 학생 이름과 연체 일수가 표시됩니다.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {overdueLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-red-50/30">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-900">
                    {loan.studentName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-600">
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 font-semibold text-red-700">
                      {loan.overdueDaysLabel}일
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
