'use client'

import { AlertCircle, ClipboardList, Clock, Loader2, RotateCcw, Search } from 'lucide-react'
import { isLoanOverdue, useLoanManager } from '@/components/admin/useLoanManager'

export default function LoanManager() {
  const {
    errorMessage,
    extendDueDate,
    filteredLoans,
    forceOverdue,
    isLoading,
    searchQuery,
    setSearchQuery,
    updateLoanStatus,
  } = useLoanManager()

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
            onChange={(event) => setSearchQuery(event.target.value)}
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
                const overdue = isLoanOverdue(loan.due_on)

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
