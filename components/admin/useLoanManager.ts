'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateLoanAction } from '@/app/admin/loans/actions'
import type { LoanStatus, LoanWithBookAndStudent } from '@/types/library'

export type Loan = LoanWithBookAndStudent

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

export function useLoanManager(initialLoans: Loan[]) {
  const router = useRouter()
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoans(initialLoans)
  }, [initialLoans])

  const applyLoanMutation = useCallback(
    async (loanId: string, body: Record<string, string | null>) => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const result = await updateLoanAction(loanId, body)

        if (result.error) {
          throw new Error(result.error.message)
        }

        if (!result.data) {
          throw new Error('상태 변경 결과를 확인하지 못했습니다.')
        }

        const updatedLoan = result.data

        if (updatedLoan.status === 'rented') {
          setLoans((current) =>
            current.some((loan) => loan.id === updatedLoan.id)
              ? current.map((loan) => (loan.id === updatedLoan.id ? updatedLoan : loan))
              : [updatedLoan, ...current]
          )
        } else {
          setLoans((current) => current.filter((loan) => loan.id !== loanId))
        }

        router.refresh()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '상태 변경에 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    },
    [router]
  )

  const refreshLoans = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshLoans()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshLoans])

  const updateLoanStatus = useCallback(
    async (loanId: string, status: LoanStatus) => {
      await applyLoanMutation(loanId, { status })
    },
    [applyLoanMutation]
  )

  const extendDueDate = useCallback(
    async (loanId: string) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const newDueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

      await applyLoanMutation(loanId, { dueOn: formatLocalDate(newDueDate) })
    },
    [applyLoanMutation]
  )

  const forceOverdue = useCallback(
    async (loan: Loan) => {
      const yesterday = new Date()
      yesterday.setHours(0, 0, 0, 0)
      yesterday.setDate(yesterday.getDate() - 1)
      const overdueDateString = formatLocalDate(yesterday)

      await applyLoanMutation(loan.id, {
        borrowedOn: overdueDateString,
        dueOn: overdueDateString,
      })
    },
    [applyLoanMutation]
  )

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
