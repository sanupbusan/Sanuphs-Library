'use client'

import Link from 'next/link'
import { Library, Plus, Trash2 } from 'lucide-react'
import { DashboardRefreshButton, type DashboardRefreshProps } from '@/components/dashboard/DashboardRefreshButton'
import type { RecentBook } from '@/lib/dashboard-data'

type BookManagementPanelProps = {
  books: RecentBook[]
} & DashboardRefreshProps

export function BookManagementPanel({ books, isRefreshing, onRefresh }: BookManagementPanelProps) {
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
