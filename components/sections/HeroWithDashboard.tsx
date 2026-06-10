'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  LayoutDashboard,
  Library,
  ClipboardList,
  RotateCcw,
  AlertCircle,
  BarChart3,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react'
import { getDashboardData, getRecentBooks, type DashboardSummary, type RecentBook, type RecentLoan } from '@/lib/library-queries'
import { getBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type ActiveDashboardPanel = 'dashboard' | 'books'
type RentalStatus = 'rented' | 'overdue' | 'returned'

type DashboardStat = {
  icon: LucideIcon
  label: string
  value: string
  color: string
}

type RecentRental = {
  id: string
  studentName: string
  bookTitle: string
  rentalDate: string
  returnDate: string
  status: RentalStatus
}

type RecentBookItem = {
  id: string
  title: string
  author: string
  category: string
  addedDate: string
  availableCopies: string
}

const sidebarMenuItems: Array<{ icon: LucideIcon; label: string; panel?: ActiveDashboardPanel }> = [
  { icon: LayoutDashboard, label: '대시보드', panel: 'dashboard' },
  { icon: Library, label: '도서관리', panel: 'books' },
  { icon: ClipboardList, label: '대여관리' },
  { icon: RotateCcw, label: '반납관리' },
  { icon: AlertCircle, label: '연체관리' },
  { icon: BarChart3, label: '통계' },
]

const fallbackStats: DashboardStat[] = [
  { icon: BookOpen, label: '전체 도서', value: '-', color: 'bg-blue-50 text-blue-600' },
  { icon: ClipboardList, label: '대여 중', value: '-', color: 'bg-green-50 text-green-600' },
  { icon: AlertCircle, label: '연체', value: '-', color: 'bg-red-50 text-red-600' },
]

const numberFormatter = new Intl.NumberFormat('ko-KR')
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(value ?? 0)
}

function buildStats(summary: DashboardSummary): DashboardStat[] {
  return [
    {
      icon: BookOpen,
      label: '전체 도서',
      value: formatNumber(summary.total_books),
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: ClipboardList,
      label: '대여 중',
      value: formatNumber(summary.active_loans),
      color: 'bg-green-50 text-green-600',
    },
    {
      icon: AlertCircle,
      label: '연체',
      value: formatNumber(summary.overdue_loans),
      color: 'bg-red-50 text-red-600',
    },
  ]
}

function normalizeRentalStatus(status: RecentLoan['status']): RentalStatus {
  if (status === 'overdue' || status === 'returned') {
    return status
  }

  return 'rented'
}

function mapRecentLoans(loans: RecentLoan[]): RecentRental[] {
  return loans.map((loan, index) => ({
    id: loan.id ?? `loan-${index}`,
    studentName: loan.student_name ?? '-',
    bookTitle: loan.book_title ?? '-',
    rentalDate: loan.rental_date ?? '-',
    returnDate: loan.return_date ?? '-',
    status: normalizeRentalStatus(loan.status),
  }))
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return dateFormatter.format(date)
}

function mapRecentBooks(books: RecentBook[]): RecentBookItem[] {
  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    addedDate: formatDate(book.created_at),
    availableCopies: `${formatNumber(book.available_copies)} / ${formatNumber(book.total_copies)}권`,
  }))
}

function getStatusLabel(status: RentalStatus) {
  if (status === 'overdue') {
    return '연체'
  }

  if (status === 'returned') {
    return '반납'
  }

  return '대여 중'
}

function getStatusColor(status: RentalStatus) {
  if (status === 'overdue') {
    return 'bg-red-50 text-red-700'
  }

  if (status === 'returned') {
    return 'bg-gray-100 text-gray-600'
  }

  return 'bg-green-50 text-green-700'
}

function warnIfDevelopment(message: string, error: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(message, error)
  }
}

function Sidebar({
  activePanel,
  onSelectPanel,
}: {
  activePanel: ActiveDashboardPanel
  onSelectPanel: (panel: ActiveDashboardPanel) => void
}) {
  return (
    <div className="flex w-40 flex-shrink-0 flex-col bg-primary-700 py-4">
      <div className="mb-6 flex items-center px-4">
        <img src="/logo.png" alt="SanupHs Library" className="h-5 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {sidebarMenuItems.map((item) => {
          const isActive = item.panel === activePanel

          return (
            <button
              key={item.label}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (item.panel) {
                  onSelectPanel(item.panel)
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: DashboardStat) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-xs text-gray-500">{label}</p>
        <p className="whitespace-nowrap text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function RecentRentalsTable({ rentals }: { rentals: RecentRental[] }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">최근 대여 현황</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-t border-b border-gray-50 bg-gray-50/50">
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">학생이름</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">도서명</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">대여일</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">반납예정일</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rentals.length === 0 ? (
              <tr>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">-</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">-</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">-</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">-</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">-</td>
              </tr>
            ) : (
              rentals.map((rental) => (
                <tr key={rental.id} className="hover:bg-gray-50/50">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-900">{rental.studentName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-900">{rental.bookTitle}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{rental.rentalDate}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{rental.returnDate}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', getStatusColor(rental.status))}>
                      {getStatusLabel(rental.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-50 px-4 py-2">
        <a href="#" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
          전체 보기
          <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

function RecentBooksPanel({ books }: { books: RecentBookItem[] }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">최근 추가된 책</h3>
          <p className="mt-1 text-xs text-gray-500">새로 등록된 도서를 최신순으로 확인합니다.</p>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700"
        >
          <Plus className="h-3.5 w-3.5" />
          책 추가하기
        </button>
      </div>

      <div className="divide-y divide-gray-50 border-t border-gray-50">
        {books.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs font-medium text-gray-700">아직 등록된 책이 없습니다.</p>
            <p className="mt-1 text-xs text-gray-500">책 추가하기 버튼으로 첫 도서를 등록하세요.</p>
          </div>
        ) : (
          books.map((book) => (
            <div key={book.id} className="grid gap-3 px-4 py-3 hover:bg-gray-50/50 sm:grid-cols-[minmax(0,1.4fr)_0.8fr_0.7fr_0.7fr]">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-900">{book.title}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{book.author}</p>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-400">분류</p>
                <p className="truncate text-xs text-gray-700">{book.category}</p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-400">등록일</p>
                <p className="whitespace-nowrap text-xs text-gray-700">{book.addedDate}</p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-400">보유</p>
                <p className="whitespace-nowrap text-xs text-gray-700">{book.availableCopies}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function DashboardMockup({
  stats,
  recentRentals,
  recentBooks,
}: {
  stats: DashboardStat[]
  recentRentals: RecentRental[]
  recentBooks: RecentBookItem[]
}) {
  const [activePanel, setActivePanel] = useState<ActiveDashboardPanel>('dashboard')

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex">
        <Sidebar activePanel={activePanel} onSelectPanel={setActivePanel} />

        <div className="flex-1 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              {activePanel === 'books' ? '도서관리' : '대시보드'}
            </h2>
          </div>

          {activePanel === 'books' ? (
            <RecentBooksPanel books={recentBooks} />
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <StatCard key={stat.label} {...stat} />
                ))}
              </div>

              <RecentRentalsTable rentals={recentRentals} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HeroWithDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentRentals, setRecentRentals] = useState<RecentRental[]>([])
  const [recentBooks, setRecentBooks] = useState<RecentBookItem[]>([])

  const stats = useMemo(() => {
    if (!summary) {
      return fallbackStats
    }

    return buildStats(summary)
  }, [summary])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }

    let didCancel = false

    async function loadDashboardData() {
      try {
        const client = getBrowserSupabaseClient()
        const [dashboardDataResult, recentBooksResult] = await Promise.allSettled([
          getDashboardData(client),
          getRecentBooks(client),
        ])

        if (didCancel) {
          return
        }

        if (dashboardDataResult.status === 'fulfilled') {
          setSummary(dashboardDataResult.value.summary)
          setRecentRentals(mapRecentLoans(dashboardDataResult.value.recentLoans))
        } else {
          warnIfDevelopment('Supabase dashboard data unavailable:', dashboardDataResult.reason)
        }

        if (recentBooksResult.status === 'fulfilled') {
          setRecentBooks(mapRecentBooks(recentBooksResult.value))
        } else {
          warnIfDevelopment('Supabase recent books unavailable:', recentBooksResult.reason)
        }
      } catch (error) {
        warnIfDevelopment('Supabase client unavailable:', error)
      }
    }

    void loadDashboardData()

    return () => {
      didCancel = true
    }
  }, [])

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(380px,5fr)_minmax(580px,7fr)]">
          <div className="max-w-xl">
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
                href="#search"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30"
              >
                <Search className="h-5 w-5" />
                도서 검색하기
              </a>
            </div>
          </div>

          <div className="hidden lg:block">
            <DashboardMockup stats={stats} recentRentals={recentRentals} recentBooks={recentBooks} />
          </div>
        </div>
      </div>
    </section>
  )
}
