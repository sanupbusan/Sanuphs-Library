'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetLoanRecordsAction, updateLoanAction } from '@/app/admin/loans/actions'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { readJsonResponse } from '@/lib/api-client'
import { formatDateKey } from '@/lib/shared/date'
import type { ApiResponse, LoanStatus, LoanWithBookAndStudent } from '@/types/library'

export type Loan = LoanWithBookAndStudent

type LoanListResponse = ApiResponse<Loan[]>

type LoanMutationBody = {
  borrowedOn?: string | null
  dueOn?: string | null
  status?: LoanStatus | string | null
  forceOverdue?: boolean
  devKey?: string | null
}

export function useLoanManager(initialLoans: Loan[]) {
  const router = useRouter()
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshErrorMessage, setRefreshErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const isMountedRef = useRef(true)
  const isMutatingRef = useRef(false)
  const isRefreshingRef = useRef(false)
  const mutationVersionRef = useRef(0)

  useEffect(() => {
    setLoans(initialLoans)
    setRefreshErrorMessage('')
  }, [initialLoans])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const refreshLoans = useCallback(async () => {
    if (
      !isMountedRef.current ||
      isMutatingRef.current ||
      isRefreshingRef.current ||
      document.visibilityState !== 'visible'
    ) {
      return
    }

    const requestedMutationVersion = mutationVersionRef.current
    isRefreshingRef.current = true

    try {
      const response = await fetch('/api/loans', {
        cache: 'no-store',
      })
      const payload = await readJsonResponse<LoanListResponse>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '최신 대여 목록을 불러오지 못했습니다.')
      }

      if (!Array.isArray(payload.data)) {
        throw new Error('최신 대여 목록을 확인하지 못했습니다.')
      }

      if (
        !isMountedRef.current ||
        isMutatingRef.current ||
        requestedMutationVersion !== mutationVersionRef.current
      ) {
        return
      }

      setLoans(payload.data)
      setRefreshErrorMessage('')
    } catch (error) {
      if (
        !isMountedRef.current ||
        isMutatingRef.current ||
        requestedMutationVersion !== mutationVersionRef.current
      ) {
        return
      }

      setRefreshErrorMessage(
        error instanceof Error ? error.message : '최신 대여 목록을 불러오지 못했습니다.'
      )
    } finally {
      isRefreshingRef.current = false
    }
  }, [])

  useAutoRefresh(refreshLoans)

  const applyLoanMutation = useCallback(
    async (loanId: string, body: LoanMutationBody) => {
      if (isMutatingRef.current) {
        return
      }

      isMutatingRef.current = true
      mutationVersionRef.current += 1
      setIsLoading(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const result = await updateLoanAction(loanId, body)

        if (result.error) {
          throw new Error(result.error.message)
        }

        if (!result.data) {
          throw new Error('상태 변경 결과를 확인하지 못했습니다.')
        }

        const updatedLoan = result.data

        if (isMountedRef.current) {
          if (updatedLoan.status === 'rented') {
            setLoans((current) =>
              current.some((loan) => loan.id === updatedLoan.id)
                ? current.map((loan) => (loan.id === updatedLoan.id ? updatedLoan : loan))
                : [updatedLoan, ...current]
            )
          } else {
            setLoans((current) => current.filter((loan) => loan.id !== loanId))
          }
        }

        router.refresh()
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(error instanceof Error ? error.message : '상태 변경에 실패했습니다.')
        }
      } finally {
        isMutatingRef.current = false

        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    },
    [router]
  )

  const resetLoanRecords = useCallback(
    async (devKey: string) => {
      if (isMutatingRef.current) {
        return
      }

      isMutatingRef.current = true
      mutationVersionRef.current += 1
      setIsLoading(true)
      setErrorMessage('')
      setRefreshErrorMessage('')
      setSuccessMessage('')

      try {
        const result = await resetLoanRecordsAction(devKey)

        if (result.error) {
          throw new Error(result.error.message)
        }

        if (result.data?.cleared !== true) {
          throw new Error('대여 기록 초기화 결과를 확인하지 못했습니다.')
        }

        if (isMountedRef.current) {
          setLoans([])
          setSuccessMessage('대여 기록을 초기화했습니다.')
          router.refresh()
        }
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(error instanceof Error ? error.message : '대여 기록 초기화에 실패했습니다.')
        }
      } finally {
        isMutatingRef.current = false

        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    },
    [router]
  )

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

      await applyLoanMutation(loanId, { dueOn: formatDateKey(newDueDate) })
    },
    [applyLoanMutation]
  )

  const forceOverdue = useCallback(
    async (loan: Loan, devKey: string) => {
      const yesterday = new Date()
      yesterday.setHours(0, 0, 0, 0)
      yesterday.setDate(yesterday.getDate() - 1)
      const overdueDateString = formatDateKey(yesterday)

      await applyLoanMutation(loan.id, {
        borrowedOn: overdueDateString,
        dueOn: overdueDateString,
        forceOverdue: true,
        devKey,
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
    refreshErrorMessage,
    resetLoanRecords,
    searchQuery,
    setSearchQuery,
    successMessage,
    updateLoanStatus,
  }
}
