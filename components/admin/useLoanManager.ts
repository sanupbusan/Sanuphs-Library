'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { readJsonResponse } from '@/lib/api-client'
import type { ApiResponse, LoanStatus, LoanWithBookAndStudent } from '@/types/library'

export type Loan = LoanWithBookAndStudent
type LoansResponse = ApiResponse<Loan[]>
type LoanMutationResponse = ApiResponse<null>

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function isLoanOverdue(dueOn: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueOn}T00:00:00`)

  return due < today
}

async function fetchLoans() {
  const response = await fetch('/api/loans', { cache: 'no-store' })
  const payload = await readJsonResponse<LoansResponse>(response)

  if (!response.ok) {
    throw new Error(payload.error?.message ?? '대여 목록을 불러오지 못했습니다.')
  }

  return payload.data ?? []
}

async function patchLoan(loanId: string, body: Record<string, string | null>) {
  const response = await fetch(`/api/loans/${loanId}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })

  if (!response.ok) {
    const payload = await readJsonResponse<LoanMutationResponse>(response)

    throw new Error(payload.error?.message ?? '상태 변경에 실패했습니다.')
  }
}

export function useLoanManager() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const loadLoans = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      setLoans(await fetchLoans())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대여 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateLoanStatus = useCallback(
    async (loanId: string, status: LoanStatus) => {
      try {
        setErrorMessage('')
        await patchLoan(loanId, { status })
        await loadLoans()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '상태 변경에 실패했습니다.')
      }
    },
    [loadLoans]
  )

  const extendDueDate = useCallback(
    async (loanId: string) => {
      try {
        setErrorMessage('')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const newDueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

        await patchLoan(loanId, { dueOn: formatLocalDate(newDueDate) })
        await loadLoans()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '기한 연장에 실패했습니다.')
      }
    },
    [loadLoans]
  )

  const forceOverdue = useCallback(
    async (loan: Loan) => {
      try {
        setErrorMessage('')
        const yesterday = new Date()
        yesterday.setHours(0, 0, 0, 0)
        yesterday.setDate(yesterday.getDate() - 1)
        const overdueDateString = formatLocalDate(yesterday)

        await patchLoan(loan.id, {
          borrowedOn: overdueDateString,
          dueOn: overdueDateString,
        })
        await loadLoans()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '연체 처리에 실패했습니다.')
      }
    },
    [loadLoans]
  )

  useEffect(() => {
    void loadLoans()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadLoans()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [loadLoans])

  const filteredLoans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return loans
    }

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

  return {
    errorMessage,
    extendDueDate,
    filteredLoans,
    forceOverdue,
    isLoading,
    searchQuery,
    setSearchQuery,
    updateLoanStatus,
  }
}
