'use client'

import {
  BookOpen,
  LayoutDashboard,
  Library,
  ClipboardList,
  RotateCcw,
  AlertCircle,
  Heart,
  BarChart3,
  Settings,
  ChevronRight,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sidebarMenuItems = [
  { icon: LayoutDashboard, label: '대시보드', active: true },
  { icon: Library, label: '도서관리', active: false },
  { icon: ClipboardList, label: '대여관리', active: false },
  { icon: RotateCcw, label: '반납관리', active: false },
  { icon: AlertCircle, label: '연체관리', active: false },
  { icon: Heart, label: '희망관리', active: false },
  { icon: BarChart3, label: '통계', active: false },
  { icon: Settings, label: '설정', active: false },
]

const stats = [
  { icon: BookOpen, label: '전체 도서', value: '1,284', color: 'bg-blue-50 text-blue-600' },
  { icon: ClipboardList, label: '대여 중', value: '128', color: 'bg-green-50 text-green-600' },
  { icon: AlertCircle, label: '연체', value: '6', color: 'bg-red-50 text-red-600' },
]

const recentRentals = [
  { id: 1, studentName: '김서연', bookTitle: '아몬드', rentalDate: '2024-05-16', returnDate: '2024-05-30', status: 'rented' as const },
  { id: 2, studentName: '이준호', bookTitle: '불편한 편의점', rentalDate: '2024-05-15', returnDate: '2024-05-29', status: 'rented' as const },
  { id: 3, studentName: '박민지', bookTitle: '82년생 김지영', rentalDate: '2024-05-10', returnDate: '2024-05-24', status: 'overdue' as const },
  { id: 4, studentName: '최도현', bookTitle: '데미안', rentalDate: '2024-05-08', returnDate: '2024-05-22', status: 'overdue' as const },
  { id: 5, studentName: '정하린', bookTitle: '어린 왕자', rentalDate: '2024-05-14', returnDate: '2024-05-28', status: 'rented' as const },
]

function Sidebar() {
  return (
    <div className="flex w-40 flex-shrink-0 flex-col bg-primary-700 py-4">
      <div className="mb-6 flex items-center px-4">
        <img src="/logo.png" alt="SanupHs Library" className="h-5 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {sidebarMenuItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              item.active
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon className="h-4 w-4" />
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

function RecentRentalsTable() {
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
            {recentRentals.map((rental) => (
              <tr key={rental.id} className="hover:bg-gray-50/50">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-900">{rental.studentName}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-900">{rental.bookTitle}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{rental.rentalDate}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{rental.returnDate}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      rental.status === 'rented'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    )}
                  >
                    {rental.status === 'rented' ? '대여 중' : '연체'}
                  </span>
                </td>
              </tr>
            ))}
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

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex">
        <Sidebar />

        <div className="flex-1 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">대시보드</h2>


          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>

          <RecentRentalsTable />
        </div>
      </div>
    </div>
  )
}

export default function HeroWithDashboard() {
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
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
