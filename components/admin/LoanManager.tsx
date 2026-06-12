'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Loader2, RotateCcw, AlertCircle, Search, Clock } from 'lucide-react'

type Loan = {
  borrowed_on: string
  due_on: string
  id: string
  returned_on: string | null
  status: 'rented' | 'returned'
  books: { title: string; school_book_code: string | null } | null
  students: { name: string; student_number: string } | null
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function LoanManager() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  async function loadLoans() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/loans', { cache: 'no-store' })
      const payload = await response.json() as { data?: Loan[]; error?: { message: string } }

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '대여 목록을 불러오지 못했습니다.')
      }

      setLoans(payload.data ?? [])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대여 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  async function updateLoanStatus(loanId: string, status: 'rented' | 'returned') {
    try {
      setErrorMessage('')
      const response = await fetch(`/api/loans/${loanId}`, {
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })

      if (!response.ok) {
        const payload = await response.json() as { error?: { message: string } }
        throw new Error(payload.error?.message ?? '상태 변경에 실패했습니다.')
      }

      await loadLoans()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '상태 변경에 실패했습니다.')
    }
  }

  async function extendDueDate(loanId: string) {
    try {
      setErrorMessage('')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const newDueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const dueOnString = formatLocalDate(newDueDate)

      const response = await fetch(`/api/loans/${loanId}`, {
        body: JSON.stringify({ dueOn: dueOnString }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })

      if (!response.ok) {
        const payload = await response.json() as { error?: { message: string } }
        throw new Error(payload.error?.message ?? '기한 연장에 실패했습니다.')
      }

      await loadLoans()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '기한 연장에 실패했습니다.')
    }
  }

  async function forceOverdue(loan: Loan) {
    try {
      setErrorMessage('')
      const yesterday = new Date()
      yesterday.setHours(0, 0, 0, 0)
      yesterday.setDate(yesterday.getDate() - 1)
      const overdueDateString = formatLocalDate(yesterday)

      const response = await fetch(`/api/loans/${loan.id}`, {
        body: JSON.stringify({
          borrowedOn: overdueDateString,
          dueOn: overdueDateString,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })

      if (!response.ok) {
        const payload = await response.json() as { error?: { message: string } }
        throw new Error(payload.error?.message ?? '연체 처리에 실패했습니다.')
      }

      await loadLoans()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '연체 처리에 실패했습니다.')
    }
  }

  useEffect(() => {
    void loadLoans()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadLoans()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const isOverdue = (dueOn: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(`${dueOn}T00:00:00`)
    return due < today
  }

  const filteredLoans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return loans

    return loans.filter((loan) => {
      const bookTitle = loan.books?.title?.toLowerCase() ?? ''
      const bookCode = loan.books?.school_book_code?.toLowerCase() ?? ''
      const studentName = loan.students?.name?.toLowerCase() ?? ''
      const studentNumber = loan.students?.student_number?.toLowerCase() ?? ''

      return (
        bookTitle.includes(query) ||
        bookCode.includes(query) ||
        studentName.includes(query) ||
        studentNumber.includes(query)
      )
    })
  }, [loans, searchQuery])

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">대여 관리</h1>
          <p className="mt-1 text-sm text-gray-600">현재 대여 중인 도서와 대여자를 확인하고 상태를 변경할 수 있습니다.</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="도서명, 학교 도서 코드, 학생 이름, 학번으로 검색"
            className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            type="text"
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : filteredLoans.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            {searchQuery ? '검색 결과가 없습니다.' : '현재 대여 중인 도서가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">학교 도서 코드</th>
                <th className="px-4 py-3">도서명</th>
                <th className="px-4 py-3">대여자</th>
                <th className="px-4 py-3">학번</th>
                <th className="px-4 py-3">대여일</th>
                <th className="px-4 py-3">반납예정일</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredLoans.map((loan) => {
                const overdue = isOverdue(loan.due_on)

                return (
                  <tr key={loan.id}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {loan.books?.school_book_code ?? '-'}
                    </td>
                    <td className="max-w-[260px] px-4 py-3 font-medium text-gray-900">
                      {loan.books?.title ?? '-'}
                    </td>
                    <td className="px-4 py-3">{loan.students?.name ?? '-'}</td>
                    <td className="px-4 py-3">{loan.students?.student_number ?? '-'}</td>
                    <td className="px-4 py-3">{loan.borrowed_on}</td>
                    <td className="px-4 py-3">
                      <span className={overdue ? 'font-semibold text-red-600' : ''}>
                        {loan.due_on}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertCircle className="h-3 w-3" />
                          연체
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          대여중
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {loan.status === 'rented' ? (
                          <>
                            <button
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary-50 px-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                              onClick={() => {
                                void updateLoanStatus(loan.id, 'returned')
                              }}
                              type="button"
                            >
                              <RotateCcw className="h-3 w-3" />
                              반납
                            </button>
                            <button
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-50 px-2.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                              onClick={() => {
                                void extendDueDate(loan.id)
                              }}
                              type="button"
                            >
                              <Clock className="h-3 w-3" />
                              기한 연장
                            </button>
                            {!overdue ? (
                              <button
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                                onClick={() => {
                                  void forceOverdue(loan)
                                }}
                                type="button"
                              >
                                <AlertCircle className="h-3 w-3" />
                                연체 테스트
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                            onClick={() => {
                              void updateLoanStatus(loan.id, 'rented')
                            }}
                            type="button"
                          >
                            대여중으로
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
