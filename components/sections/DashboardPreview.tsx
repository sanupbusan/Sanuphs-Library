'use client'

import {
  BookOpen,
  LayoutDashboard,
  Library,
  ClipboardList,
  RotateCcw,
  AlertCircle,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sidebarMenuItems = [
  { icon: LayoutDashboard, label: '대시보드', active: true },
  { icon: Library, label: '도서관리', active: false },
  { icon: ClipboardList, label: '대여관리', active: false },
  { icon: RotateCcw, label: '반납관리', active: false },
  { icon: AlertCircle, label: '연체관리', active: false },
  { icon: BarChart3, label: '통계', active: false },
]

const stats = [
  { icon: BookOpen, label: '전체 도서', value: '-', color: 'bg-blue-50 text-blue-600' },
  { icon: ClipboardList, label: '대여 중', value: '-', color: 'bg-green-50 text-green-600' },
  { icon: AlertCircle, label: '연체', value: '-', color: 'bg-red-50 text-red-600' },
]

const recentRentals: Array<{
  id: number
  studentName: string
  bookTitle: string
  rentalDate: string
  returnDate: string
  status: 'rented' | 'overdue'
}> = []

function Sidebar() {
  return (
    <div className="flex w-56 flex-col bg-primary-700 py-6">
      <div className="mb-8 flex items-center gap-2 px-6">
        <BookOpen className="h-6 w-6 text-white" />
        <span className="text-lg font-bold text-white">BookBridge</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {sidebarMenuItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
              item.active
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof BookOpen
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function RecentRentalsTable() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="px-6 py-4">
        <h3 className="text-base font-semibold text-gray-900">최근 대여 현황</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-t border-b border-gray-50 bg-gray-50/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">학생이름</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">도서명</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">대여일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">반납예정일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentRentals.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-sm text-gray-500">-</td>
                <td className="px-6 py-4 text-sm text-gray-500">-</td>
                <td className="px-6 py-4 text-sm text-gray-500">-</td>
                <td className="px-6 py-4 text-sm text-gray-500">-</td>
                <td className="px-6 py-4 text-sm text-gray-500">-</td>
              </tr>
            ) : (
              recentRentals.map((rental) => (
                <tr key={rental.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm text-gray-900">{rental.studentName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{rental.bookTitle}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{rental.rentalDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{rental.returnDate}</td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        rental.status === 'rented'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      )}
                    >
                      {rental.status === 'rented' ? '대여 중' : '연체'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-50 px-6 py-3">
        <a href="#" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
          전체 보기
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}

export default function DashboardPreview() {
  return (
    <section id="rental" className="bg-gray-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            직관적인 대시보드로
            <br className="sm:hidden" />
            {' '}한눈에 확인하세요
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            실시간으로 도서 현황과 대여 정보를 확인할 수 있습니다
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="flex">
            <Sidebar />

            <div className="flex-1 p-6 sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">대시보드</h2>

                <div className="flex items-center gap-4">
                  <button className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700">
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
                  </button>

                  <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    관리자님
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <StatCard key={stat.label} {...stat} />
                ))}
              </div>

              <RecentRentalsTable />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
