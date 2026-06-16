'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusColor, getStatusLabel, type RecentRental } from '@/lib/dashboard-data'

export function RecentRentalsTable({ rentals }: { rentals: RecentRental[] }) {
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
        <a
          href="/admin/loans"
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          전체 보기
          <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
