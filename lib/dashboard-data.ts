import type {
  DashboardSummary,
  OverdueLoan as OverdueLoanRow,
  RecentBook as RecentBookRow,
  RecentLoan,
  StudentLoanStat as StudentLoanStatRow,
} from '@/lib/library-queries'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, ClipboardList, AlertCircle } from 'lucide-react'
import {
  formatKoreanDate,
  getOverdueDays,
  getTodayDateKey,
} from '@/lib/loan-restrictions'

export { formatKoreanDate } from '@/lib/loan-restrictions'

export type RentalStatus = 'rented' | 'overdue' | 'returned'

export type DashboardStat = {
  icon: LucideIcon
  label: string
  value: string
  color: string
}

export type RecentRental = {
  id: string
  studentName: string
  bookTitle: string
  rentalDate: string
  returnDate: string
  status: RentalStatus
}

export type RecentBook = {
  id: string
  title: string
  author: string
  category: string
  createdAt: string
  availableCopies: number
  totalCopies: number
}

export type StudentLoanStatistic = {
  id: string
  studentName: string
  totalLoans: number
  totalLoansLabel: string
}

export type OverdueLoan = {
  id: string
  overdueDays: number
  overdueDaysLabel: string
  studentName: string
}

const numberFormatter = new Intl.NumberFormat('ko-KR')
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(value ?? 0)
}

export function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return dateFormatter.format(date)
}

export function getReturnSuccessMessage(data: {
  bookTitle: string
  loanBannedUntil: string | null
  overdueDays: number
  studentName: string
}) {
  if (data.overdueDays > 0 && data.loanBannedUntil) {
    return `"${data.bookTitle}" 반납 완료. ${data.studentName} 학생은 연체 ${data.overdueDays}일로 ${formatKoreanDate(
      data.loanBannedUntil
    )}까지 대출할 수 없습니다.`
  }

  return `"${data.bookTitle}" 반납 완료`
}

export const fallbackStats: DashboardStat[] = [
  { icon: BookOpen, label: '전체 도서', value: '-', color: 'bg-blue-50 text-blue-600' },
  { icon: ClipboardList, label: '대여 중', value: '-', color: 'bg-green-50 text-green-600' },
  { icon: AlertCircle, label: '연체', value: '-', color: 'bg-red-50 text-red-600' },
]

export function buildStats(summary: DashboardSummary): DashboardStat[] {
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

export function mapRecentLoans(loans: RecentLoan[]): RecentRental[] {
  return loans.map((loan, index) => ({
    id: loan.id ?? `loan-${index}`,
    studentName: loan.student_name ?? '-',
    bookTitle: loan.book_title ?? '-',
    rentalDate: loan.rental_date ?? '-',
    returnDate: loan.return_date ?? '-',
    status: normalizeRentalStatus(loan.status),
  }))
}

export function mapRecentBooks(books: RecentBookRow[]): RecentBook[] {
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

export function mapStudentLoanStats(studentStats: StudentLoanStatRow[]): StudentLoanStatistic[] {
  return studentStats.map((studentStat) => ({
    id: studentStat.student_id,
    studentName: studentStat.student_name,
    totalLoans: studentStat.total_loans,
    totalLoansLabel: formatNumber(studentStat.total_loans),
  }))
}

export function mapOverdueLoans(loans: OverdueLoanRow[]): OverdueLoan[] {
  const today = getTodayDateKey()

  return loans.map((loan) => {
    const overdueDays = getOverdueDays(loan.due_on, today)

    return {
      id: loan.id,
      overdueDays,
      overdueDaysLabel: formatNumber(overdueDays),
      studentName: loan.student_name,
    }
  })
}

export function getStatusLabel(status: RentalStatus) {
  if (status === 'overdue') {
    return '연체'
  }

  if (status === 'returned') {
    return '반납'
  }

  return '대여 중'
}

export function getStatusColor(status: RentalStatus) {
  if (status === 'overdue') {
    return 'bg-red-50 text-red-700'
  }

  if (status === 'returned') {
    return 'bg-gray-100 text-gray-600'
  }

  return 'bg-green-50 text-green-700'
}
