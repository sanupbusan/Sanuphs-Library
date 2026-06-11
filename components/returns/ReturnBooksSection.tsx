'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { BookOpen, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'

type ReturnableLoan = {
  book_title: string
  borrowed_on: string
  due_on: string
  loan_id: string
  school_book_code: string | null
  student_name: string
}

type ReturnedLoan = {
  book_title: string
  loan_id: string
  returned_on: string
  school_book_code: string | null
  student_name: string
}

type LoanLookupResponse = {
  data?: ReturnableLoan | null
  error?: {
    code: string
    message: string
  }
}

type ReturnBooksResponse = {
  data?: ReturnedLoan[]
  error?: {
    code: string
    message: string
  }
  meta?: {
    count: number
  }
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

export default function ReturnBooksSection({ initialSchoolBookCode }: { initialSchoolBookCode: string }) {
  const initialLookupStartedRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [pendingLoans, setPendingLoans] = useState<ReturnableLoan[]>([])
  const [schoolBookCode, setSchoolBookCode] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function addReturnableLoan(nextSchoolBookCode: string) {
    const normalizedSchoolBookCode = nextSchoolBookCode.trim()

    if (!normalizedSchoolBookCode) {
      return
    }

    setIsLookingUp(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const params = new URLSearchParams({ code: normalizedSchoolBookCode })
      const response = await fetch(`/api/returns/loans?${params.toString()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as LoanLookupResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '반납할 대여 정보를 확인하지 못했습니다.')
      }

      if (!payload.data) {
        return
      }

      const returnableLoan = payload.data

      setPendingLoans((currentLoans) => {
        if (currentLoans.some((loan) => loan.loan_id === returnableLoan.loan_id)) {
          return currentLoans
        }

        return [...currentLoans, returnableLoan]
      })
      setSchoolBookCode('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '반납할 대여 정보를 확인하지 못했습니다.')
    } finally {
      setIsLookingUp(false)
    }
  }

  useEffect(() => {
    if (initialLookupStartedRef.current || !initialSchoolBookCode) {
      return
    }

    initialLookupStartedRef.current = true
    void addReturnableLoan(initialSchoolBookCode)
  }, [initialSchoolBookCode])

  function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void addReturnableLoan(schoolBookCode)
  }

  async function handleReturnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const schoolBookCodes = pendingLoans
      .map((loan) => loan.school_book_code?.trim() ?? '')
      .filter(Boolean)

    if (schoolBookCodes.length === 0 || isReturning) {
      return
    }

    setIsReturning(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/returns', {
        body: JSON.stringify({ schoolBookCodes }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = (await response.json()) as ReturnBooksResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '도서 반납 처리에 실패했습니다.')
      }

      const returnedSchoolBookCodes = new Set(
        (payload.data ?? [])
          .map((loan) => loan.school_book_code?.trim() ?? '')
          .filter(Boolean)
      )
      const returnedCount = payload.meta?.count ?? payload.data?.length ?? 0

      if (returnedCount > 0) {
        setPendingLoans((currentLoans) =>
          currentLoans.filter((loan) => !returnedSchoolBookCodes.has(loan.school_book_code?.trim() ?? ''))
        )
        setSuccessMessage(`${returnedCount}권을 반납 처리했습니다.`)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '도서 반납 처리에 실패했습니다.')
    } finally {
      setIsReturning(false)
    }
  }

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서 반납</h1>
            <p className="mt-1 text-sm text-gray-600">학교 도서 코드를 추가한 뒤 반납하기를 눌러 처리합니다.</p>
          </div>
        </div>

        <form onSubmit={handleAddSubmit} className="mb-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="return-page-school-book-code">
            추가할 학교 도서 코드
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="return-page-school-book-code"
              value={schoolBookCode}
              onChange={(event) => setSchoolBookCode(event.target.value)}
              className="h-11 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="추가 반납할 학교 도서 코드"
              type="text"
            />
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-wait disabled:opacity-70"
              disabled={isLookingUp}
              type="submit"
            >
              {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              목록에 추가
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">대출 중인 책 코드만 목록에 추가됩니다.</p>
        </form>

        {errorMessage ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMessage}</div> : null}
        {successMessage ? <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{successMessage}</div> : null}

        <form onSubmit={handleReturnSubmit} className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <BookOpen className="h-4 w-4 text-primary-600" />
              반납 대기 목록
            </div>
            <div className="text-xs text-gray-500">{pendingLoans.length}권</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">학교 도서 코드</th>
                  <th className="px-4 py-3">도서명</th>
                  <th className="px-4 py-3">대여자</th>
                  <th className="px-4 py-3">대여일</th>
                  <th className="px-4 py-3">반납 예정일</th>
                  <th className="px-4 py-3 text-right">제외</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {pendingLoans.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                      반납할 책이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pendingLoans.map((loan) => (
                    <tr key={loan.loan_id}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{displayValue(loan.school_book_code)}</td>
                      <td className="max-w-[280px] px-4 py-3 font-medium text-gray-900">{displayValue(loan.book_title)}</td>
                      <td className="px-4 py-3">{displayValue(loan.student_name)}</td>
                      <td className="px-4 py-3">{displayValue(loan.borrowed_on)}</td>
                      <td className="px-4 py-3">{displayValue(loan.due_on)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                          onClick={() => {
                            setPendingLoans((currentLoans) => currentLoans.filter((currentLoan) => currentLoan.loan_id !== loan.loan_id))
                          }}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          제외
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-gray-100 px-4 py-4">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingLoans.length === 0 || isReturning}
              type="submit"
            >
              {isReturning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              반납하기
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
