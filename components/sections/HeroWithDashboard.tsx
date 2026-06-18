'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Search } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import {
  getDashboardData,
  getOverdueLoans,
  getRecentBooks,
  getStudentLoanStats,
} from '@/lib/library-queries'
import { isSupabaseConfigured, getBrowserSupabaseClient } from '@/lib/supabase'
import { useDashboardBarcodeListener } from '@/hooks/useDashboardBarcodeListener'
import { DashboardMockup } from '@/components/dashboard/DashboardMockup'
import {
  buildStats,
  fallbackStats,
  getReturnSuccessMessage,
  mapOverdueLoans,
  mapRecentBooks,
  mapRecentLoans,
  mapStudentLoanStats,
  type RecentBook,
  type OverdueLoan,
  type RecentRental,
  type StudentLoanStatistic,
  type DashboardStat,
} from '@/lib/dashboard-data'
import type { DashboardSummary } from '@/lib/library-queries'

type OptionalAdminSessionResponse = {
  data?: {
    user: {
      loginId: string
    }
  } | null
}

export default function HeroWithDashboard() {
  const router = useRouter()
  const { addToast } = useToast()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([])
  const [recentRentals, setRecentRentals] = useState<RecentRental[]>([])
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([])
  const [studentLoanStats, setStudentLoanStats] = useState<StudentLoanStatistic[]>([])
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [isCheckingAdminSession, setIsCheckingAdminSession] = useState(true)
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false)

  function clearDashboardData() {
    setSummary(null)
    setOverdueLoans([])
    setRecentRentals([])
    setRecentBooks([])
    setStudentLoanStats([])
  }

  async function checkAdminSession() {
    try {
      const response = await fetch('/api/auth/admin/session?optional=1', {
        cache: 'no-store',
      })
      const payload = (await response.json()) as OptionalAdminSessionResponse

      return response.ok && Boolean(payload.data?.user.loginId)
    } catch {
      return false
    }
  }

  async function loadDashboardData() {
    if (!isSupabaseConfigured()) {
      return
    }

    try {
      const client = getBrowserSupabaseClient()
      const [dashboardResult, recentBooksResult, overdueLoansResult, studentLoanStatsResult] = await Promise.allSettled([
        getDashboardData(client),
        getRecentBooks(client),
        getOverdueLoans(client),
        getStudentLoanStats(client),
      ])

      if (dashboardResult.status === 'fulfilled') {
        setSummary(dashboardResult.value.summary)
        setRecentRentals(mapRecentLoans(dashboardResult.value.recentLoans))
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('Supabase dashboard data unavailable:', dashboardResult.reason)
      }

      if (recentBooksResult.status === 'fulfilled') {
        setRecentBooks(mapRecentBooks(recentBooksResult.value))
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('Supabase recent books unavailable:', recentBooksResult.reason)
      }

      if (overdueLoansResult.status === 'fulfilled') {
        setOverdueLoans(mapOverdueLoans(overdueLoansResult.value))
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('Supabase overdue loans unavailable:', overdueLoansResult.reason)
      }

      if (studentLoanStatsResult.status === 'fulfilled') {
        setStudentLoanStats(mapStudentLoanStats(studentLoanStatsResult.value))
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('Supabase student loan stats unavailable:', studentLoanStatsResult.reason)
      }
    } catch (error) {
      console.error('Dashboard data load failed:', error)
    }
  }

  async function refreshDashboardData() {
    if (!isAdminLoggedIn) {
      return
    }

    setIsDashboardRefreshing(true)

    try {
      await loadDashboardData()
    } finally {
      setIsDashboardRefreshing(false)
    }
  }

  async function processReturn(code: string) {
    try {
      const response = await fetch('/api/returns/loans', {
        body: JSON.stringify({ code }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = (await response.json()) as {
        data?: Array<{
          book_title: string
          loan_banned_until: string | null
          overdue_days: number
          student_name: string
        }>
        error?: { message: string }
      }

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '반납 처리에 실패했습니다.')
      }

      const returnedLoan = payload.data?.[0]

      if (returnedLoan) {
        addToast(
          getReturnSuccessMessage({
            bookTitle: returnedLoan.book_title,
            loanBannedUntil: returnedLoan.loan_banned_until,
            overdueDays: returnedLoan.overdue_days,
            studentName: returnedLoan.student_name,
          }),
          'success'
        )
        if (isAdminLoggedIn) {
          await loadDashboardData()
        }
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : '반납 처리에 실패했습니다.', 'error')
    }
  }

  const stats = useMemo<DashboardStat[]>(() => {
    if (!summary) {
      return fallbackStats
    }

    return buildStats(summary)
  }, [summary])

  useEffect(() => {
    let didCancel = false

    async function syncDashboardAccess() {
      setIsCheckingAdminSession(true)

      const isLoggedIn = await checkAdminSession()

      if (didCancel) {
        return
      }

      setIsAdminLoggedIn(isLoggedIn)

      if (isLoggedIn) {
        await loadDashboardData()
      } else {
        clearDashboardData()
      }

      if (!didCancel) {
        setIsCheckingAdminSession(false)
      }
    }

    void syncDashboardAccess()

    function handleSessionChange() {
      void syncDashboardAccess()
    }

    window.addEventListener('admin-session-changed', handleSessionChange)

    return () => {
      didCancel = true
      window.removeEventListener('admin-session-changed', handleSessionChange)
    }
  }, [])

  useDashboardBarcodeListener({
    onStudentNumber: (studentNumber) => {
      router.push(`/rent?studentNumber=${encodeURIComponent(studentNumber)}`)
    },
    onReturnCode: (code) => {
      void processReturn(code)
    },
  })

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(380px,5fr)_minmax(580px,7fr)]">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5">
              <BookOpen className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">SanupHs Library</span>
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
              학교 도서 대여를
              <br />
              <span className="text-primary-600">더 쉽고 빠르게</span>
              <br />
              관리하세요
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              학생은 원하는 도서를 빠르게 검색하고,
              <br className="hidden sm:block" />
              관리자는 대여·반납·연체 현황을 한눈에 확인할 수 있습니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/books"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30"
              >
                <Search className="h-5 w-5" />
                도서 검색하기
              </a>
            </div>
          </div>

          <div className="hidden lg:block">
            <DashboardMockup
              canViewStatistics={isAdminLoggedIn}
              isCheckingSession={isCheckingAdminSession}
              summary={summary}
              overdueLoans={overdueLoans}
              stats={stats}
              recentRentals={recentRentals}
              recentBooks={recentBooks}
              studentLoanStats={studentLoanStats}
              isRefreshing={isDashboardRefreshing}
              onRefresh={refreshDashboardData}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
