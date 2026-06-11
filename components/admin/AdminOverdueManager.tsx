'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'

type OverdueRow = {
  bookTitle: string | null
  borrowedOn: string
  dueOn: string
  id: string
  studentName: string | null
  studentNumber: string | null
}

type OverdueResponse = {
  data?: OverdueRow[]
  error?: {
    code: string
    message: string
  }
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function getOverdueDays(dueOn: string) {
  const dueDate = new Date(`${dueOn}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000))
}

export default function AdminOverdueManager() {
  const router = useRouter()
  const [overdueLoans, setOverdueLoans] = useState<OverdueRow[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let didCancel = false

    async function loadOverdueLoans() {
      try {
        const response = await fetch('/api/admin/overdue', {
          cache: 'no-store',
        })
        const payload = (await response.json()) as OverdueResponse

        if (didCancel) {
          return
        }

        if (response.status === 401 || response.status === 403) {
          router.replace('/admin/login')
          return
        }

        if (!response.ok) {
          throw new Error(payload.error?.message ?? '연체 목록을 불러오지 못했습니다.')
        }

        setOverdueLoans(payload.data ?? [])
      } catch (error) {
        if (!didCancel) {
          setErrorMessage(error instanceof Error ? error.message : '연체 목록을 불러오지 못했습니다.')
        }
      } finally {
        if (!didCancel) {
          setIsLoading(false)
        }
      }
    }

    void loadOverdueLoans()

    return () => {
      didCancel = true
    }
  }, [router])

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
          {isLoading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : errorMessage ? (
            <div className="px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : (
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
                          {getOverdueDays(loan.dueOn)}일
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
