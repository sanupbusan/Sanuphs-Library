'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getTodayDateKey } from '@/lib/shared/date'
import { displayValue } from '@/lib/shared/display'
import { readJsonResponse } from '@/lib/api-client'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { getOverdueDays } from '@/services/loan-restriction.service'
import type { ApiResponseWithMeta, OverdueLoanRow } from '@/types/library'

type AdminOverdueManagerProps = {
  initialOverdueLoans: OverdueLoanRow[]
  initialToday: string
}

type OverdueLoanResponse = ApiResponseWithMeta<OverdueLoanRow[], { today: string }>

export default function AdminOverdueManager({
  initialOverdueLoans,
  initialToday,
}: AdminOverdueManagerProps) {
  const [today, setToday] = useState(initialToday)
  const [overdueLoans, setOverdueLoans] = useState(initialOverdueLoans)
  const isMountedRef = useRef(true)
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    setToday(initialToday)
    setOverdueLoans(initialOverdueLoans)
  }, [initialOverdueLoans, initialToday])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const refreshOverdueLoans = useCallback(async () => {
    if (
      !isMountedRef.current ||
      isRefreshingRef.current ||
      document.visibilityState !== 'visible'
    ) {
      return
    }

    isRefreshingRef.current = true

    try {
      const response = await fetch('/api/admin/overdue', {
        cache: 'no-store',
      })
      const payload = await readJsonResponse<OverdueLoanResponse>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '최신 연체 목록을 불러오지 못했습니다.')
      }

      if (!Array.isArray(payload.data)) {
        throw new Error('최신 연체 목록을 확인하지 못했습니다.')
      }

      if (!isMountedRef.current) {
        return
      }

      setOverdueLoans(payload.data)
      setToday(payload.meta?.today ?? getTodayDateKey())
    } finally {
      isRefreshingRef.current = false
    }
  }, [])

  useAutoRefresh(refreshOverdueLoans)

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">연체관리</h1>
            <p className="mt-1 text-sm text-gray-600">반납 예정일이 지난 대여 목록</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">학생</th>
                  <th className="px-4 py-3">학번</th>
                  <th className="px-4 py-3">도서명</th>
                  <th className="px-4 py-3">대여일</th>
                  <th className="px-4 py-3">반납 예정일</th>
                  <th className="px-4 py-3">연체일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {overdueLoans.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                      -
                    </td>
                  </tr>
                ) : (
                  overdueLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {displayValue(loan.studentName)}
                      </td>
                      <td className="px-4 py-3">{displayValue(loan.studentNumber)}</td>
                      <td className="max-w-[280px] px-4 py-3">{displayValue(loan.bookTitle)}</td>
                      <td className="px-4 py-3">{displayValue(loan.borrowedOn)}</td>
                      <td className="px-4 py-3">{displayValue(loan.dueOn)}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">
                        {getOverdueDays(loan.dueOn, today)}일
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
