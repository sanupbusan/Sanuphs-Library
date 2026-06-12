'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  LayoutDashboard,
  Library,
  ClipboardList,
  RotateCcw,
  AlertCircle,
  BarChart3,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Search,
} from 'lucide-react'
import {
  getDashboardData,
  getOverdueLoans,
  getRecentBooks,
  getStudentLoanStats,
  type DashboardSummary,
  type OverdueLoan as OverdueLoanRow,
  type RecentBook as RecentBookRow,
  type RecentLoan,
  type StudentLoanStat as StudentLoanStatRow,
} from '@/lib/library-queries'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { getBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type RentalStatus = 'rented' | 'overdue' | 'returned'
type DashboardSection = 'dashboard' | 'books' | 'overdue' | 'statistics'

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

type RecentBook = {
  id: string
  title: string
  author: string
  category: string
  createdAt: string
  availableCopies: number
  totalCopies: number
}

type StudentLoanStatistic = {
  id: string
  studentName: string
  totalLoans: number
  totalLoansLabel: string
}

type OverdueLoan = {
  id: string
  overdueDays: number
  overdueDaysLabel: string
  studentName: string
}

type DashboardRefreshProps = {
  isRefreshing: boolean
  onRefresh: () => Promise<void> | void
}

type SidebarMenuItem = {
  href?: string
  icon: LucideIcon
  label: string
  section: DashboardSection | null
}

const sidebarMenuItems: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: '대시보드', section: 'dashboard' },
  { icon: Library, label: '도서 관리', section: 'books' },
  { icon: ClipboardList, label: '대여 관리', href: '/admin/loans', section: null },
  { icon: AlertCircle, label: '연체 관리', section: 'overdue' },
  { icon: BarChart3, label: '통계', section: 'statistics' },
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

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return dateFormatter.format(date)
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`
}

function getReturnSuccessMessage(data: { bookTitle: string; loanBannedUntil: string | null; overdueDays: number; studentName: string }) {
  if (data.overdueDays > 0 && data.loanBannedUntil) {
    return `"${data.bookTitle}" 반납 완료. ${data.studentName} 학생은 연체 ${data.overdueDays}일로 ${formatKoreanDate(
      data.loanBannedUntil
    )}까지 대출할 수 없습니다.`
  }

  return `"${data.bookTitle}" 반납 완료`
}

function getOverdueDays(dueOn: string) {
  const dueDate = new Date(`${dueOn}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000))
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

function mapRecentBooks(books: RecentBookRow[]): RecentBook[] {
  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    createdAt: formatDate(book.created_at),
    availableCopies: book.available_copies,
    totalCopies: book.total_copies,
  }))
}

function mapStudentLoanStats(studentStats: StudentLoanStatRow[]): StudentLoanStatistic[] {
  return studentStats.map((studentStat) => ({
    id: studentStat.student_id,
    studentName: studentStat.student_name,
    totalLoans: studentStat.total_loans,
    totalLoansLabel: formatNumber(studentStat.total_loans),
  }))
}

function mapOverdueLoans(loans: OverdueLoanRow[]): OverdueLoan[] {
  return loans.map((loan) => {
    const overdueDays = getOverdueDays(loan.due_on)

    return {
      id: loan.id,
      overdueDays,
      overdueDaysLabel: formatNumber(overdueDays),
      studentName: loan.student_name,
    }
  })
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

function DashboardRefreshButton({ isRefreshing, onRefresh }: DashboardRefreshProps) {
  return (
    <button
      type="button"
      aria-label="대시보드 데이터 새로고침"
      disabled={isRefreshing}
      onClick={() => {
        void onRefresh()
      }}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:border-primary-100 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RotateCcw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
      {isRefreshing ? '새로고침 중' : '새로고침'}
    </button>
  )
}

function Sidebar({
  activeSection,
  onSectionChange,
}: {
  activeSection: DashboardSection
  onSectionChange: (section: DashboardSection) => void
}) {
  const router = useRouter()

  return (
    <div className="flex w-40 flex-shrink-0 flex-col bg-primary-700 py-4">
      <div className="mb-6 flex items-center px-4">
        <img src="/logo.png" alt="SanupHs Library" className="h-5 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {sidebarMenuItems.map((item) => {
          const isActive = item.section === activeSection

          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (item.href) {
                  router.push(item.href)
                } else if (item.section) {
                  onSectionChange(item.section)
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white',
                !item.section && !item.href && 'cursor-default text-white/45 hover:bg-transparent hover:text-white/45'
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

function BookManagementPanel({ books, isRefreshing, onRefresh }: { books: RecentBook[] } & DashboardRefreshProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">도서 관리</h2>
          <p className="mt-1 text-xs text-gray-500">최근 추가된 책을 빠르게 확인하세요</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />

          <Link
            href="/admin/books?mode=remove#remove-books"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            기존 책 제거
          </Link>

          <Link
            href="/admin/add_books"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            새 책 추가
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">최근 추가된 책</h3>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            최신 {books.length}권
          </span>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-gray-50 overflow-y-auto border-t border-gray-50">
          {books.length === 0 ? (
            <div className="flex h-full items-center gap-3 px-4 py-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-primary-600">
                <Library className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">최근 추가된 도서가 아직 없습니다</p>
                <p className="mt-1 text-xs text-gray-500">책을 등록하면 이 영역에 최신순으로 표시됩니다.</p>
              </div>
            </div>
          ) : (
            books.map((book) => (
              <div key={book.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50/60">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900">{book.title}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {book.author} · {book.category}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-semibold text-gray-900">
                    {book.availableCopies}/{book.totalCopies}권
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{book.createdAt}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatisticsPanel({
  summary,
  studentLoanStats,
  isRefreshing,
  onRefresh,
}: {
  summary: DashboardSummary | null
  studentLoanStats: StudentLoanStatistic[]
} & DashboardRefreshProps) {
  const summaryStats: DashboardStat[] = [
    {
      icon: BookOpen,
      label: '전체 책 수',
      value: summary ? formatNumber(summary.total_books) : '-',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: ClipboardList,
      label: '대여 중',
      value: summary ? formatNumber(summary.active_loans) : '-',
      color: 'bg-green-50 text-green-600',
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">통계</h2>
          <p className="mt-1 text-xs text-gray-500">도서 수와 학생별 대여 권수를 확인하세요</p>
        </div>

        <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {summaryStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">학생별 대여 도서 수</h3>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            기록 {studentLoanStats.length}명
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-50">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-gray-500">학생이름</th>
                <th className="whitespace-nowrap px-4 py-2 text-right text-xs font-medium text-gray-500">빌린 도서 전체 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {studentLoanStats.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">대여 기록이 있는 학생이 없습니다</p>
                        <p className="mt-1 text-xs text-gray-500">대여 기록이 생기면 학생별 전체 권수가 표시됩니다.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {studentLoanStats.map((studentStat) => (
                <tr key={studentStat.id} className="hover:bg-gray-50/60">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-900">
                    {studentStat.studentName}
                  </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-600">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-800">
                      {studentStat.totalLoansLabel}권
                      </span>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OverduePanel({ overdueLoans, isRefreshing, onRefresh }: { overdueLoans: OverdueLoan[] } & DashboardRefreshProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">연체 관리</h2>
          <p className="mt-1 text-xs text-gray-500">연체된 학생과 연체 일수를 확인하세요</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />

          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            연체 {overdueLoans.length}건
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">연체 학생 목록</h3>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            오래된 순
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-50">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-gray-500">학생이름</th>
                <th className="whitespace-nowrap px-4 py-2 text-right text-xs font-medium text-gray-500">연체 일수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {overdueLoans.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">현재 연체된 학생이 없습니다</p>
                        <p className="mt-1 text-xs text-gray-500">반납 예정일이 지나면 학생 이름과 연체 일수가 표시됩니다.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {overdueLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-red-50/30">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-900">
                    {loan.studentName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-600">
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 font-semibold text-red-700">
                      {loan.overdueDaysLabel}일
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DashboardMockup({
  summary,
  overdueLoans,
  stats,
  recentRentals,
  recentBooks,
  studentLoanStats,
  isRefreshing,
  onRefresh,
}: {
  summary: DashboardSummary | null
  overdueLoans: OverdueLoan[]
  stats: DashboardStat[]
  recentRentals: RecentRental[]
  recentBooks: RecentBook[]
  studentLoanStats: StudentLoanStatistic[]
} & DashboardRefreshProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('dashboard')

  return (
    <div className="h-[410px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex h-full">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        <div className="flex-1 overflow-hidden p-4">
          {activeSection === 'books' ? (
            <BookManagementPanel books={recentBooks} isRefreshing={isRefreshing} onRefresh={onRefresh} />
          ) : activeSection === 'overdue' ? (
            <OverduePanel overdueLoans={overdueLoans} isRefreshing={isRefreshing} onRefresh={onRefresh} />
          ) : activeSection === 'statistics' ? (
            <StatisticsPanel
              summary={summary}
              studentLoanStats={studentLoanStats}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">대시보드</h2>
                <DashboardRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
              </div>

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
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([])
  const [recentRentals, setRecentRentals] = useState<RecentRental[]>([])
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([])
  const [studentLoanStats, setStudentLoanStats] = useState<StudentLoanStatistic[]>([])
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([])
  const barcodeBufferRef = useRef('')
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastIdRef = useRef(0)

  function addToast(message: string, type: 'success' | 'error') {
    const id = ++toastIdRef.current
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 1000)
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
    setIsDashboardRefreshing(true)

    try {
      await loadDashboardData()
    } finally {
      setIsDashboardRefreshing(false)
    }
  }

  async function processReturn(code: string) {
    try {
      const normalizedCode = normalizeBarcodeInput(code)
      const response = await fetch('/api/returns/loans', {
        body: JSON.stringify({ code: normalizedCode }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = await response.json() as { data?: Array<{ book_title: string }>; error?: { message: string } }

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '반납 처리에 실패했습니다.')
      }

      const returnedLoan = payload.data?.[0]

      if (returnedLoan) {
        addToast(`"${returnedLoan.book_title}" 반납 완료`, 'success')
        await loadDashboardData()
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : '반납 처리에 실패했습니다.', 'error')
    }
  }

  const stats = useMemo(() => {
    if (!summary) {
      return fallbackStats
    }

    return buildStats(summary)
  }, [summary])

  useEffect(() => {
    void loadDashboardData()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === 'Enter') {
        const buffer = normalizeBarcodeInput(barcodeBufferRef.current)
        barcodeBufferRef.current = ''
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current)
        }

        if (!buffer) return

        if (/^[0-9]{5}$/.test(buffer)) {
          window.location.assign(`/rent?studentNumber=${encodeURIComponent(buffer)}`)
        } else {
          void processReturn(buffer)
        }
        return
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        barcodeBufferRef.current = normalizeBarcodeInput(barcodeBufferRef.current + event.key)
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current)
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          barcodeBufferRef.current = ''
        }, 100)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current)
      }
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

      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </section>
  )
}
