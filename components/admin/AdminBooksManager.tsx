'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react'
import AdminRemoveBookPanel from '@/components/admin/AdminRemoveBookPanel'

type BookRow = {
  author: string
  available_copies: number
  category: string
  created_at: string
  id: string
  isbn: string | null
  location: string | null
  publisher: string | null
  school_book_code: string | null
  title: string
  total_copies: number
}

type BooksResponse = {
  data?: BookRow[]
  error?: {
    code: string
    message: string
  }
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

export default function AdminBooksManager() {
  const router = useRouter()
  const removePanelRef = useRef<HTMLDivElement>(null)
  const [books, setBooks] = useState<BookRow[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('mode') !== 'remove' && window.location.hash !== '#remove-books') {
      return
    }

    window.requestAnimationFrame(() => {
      removePanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [])

  useEffect(() => {
    let didCancel = false

    async function loadBooks() {
      try {
        const response = await fetch('/api/admin/books', {
          cache: 'no-store',
        })
        const payload = (await response.json()) as BooksResponse

        if (didCancel) {
          return
        }

        if (response.status === 401 || response.status === 403) {
          router.replace('/admin/login')
          return
        }

        if (!response.ok) {
          throw new Error(payload.error?.message ?? '도서 목록을 불러오지 못했습니다.')
        }

        setBooks(payload.data ?? [])
      } catch (error) {
        if (!didCancel) {
          setErrorMessage(error instanceof Error ? error.message : '도서 목록을 불러오지 못했습니다.')
        }
      } finally {
        if (!didCancel) {
          setIsLoading(false)
        }
      }
    }

    void loadBooks()

    return () => {
      didCancel = true
    }
  }, [router])

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서관리</h1>
              <p className="mt-1 text-sm text-gray-600">등록된 도서 현황</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="#remove-books"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              기존 책 제거
            </Link>

            <Link
              href="/admin/add_books"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              새 책 추가
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : errorMessage ? (
            <div className="px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">도서명</th>
                    <th className="px-4 py-3">저자</th>
                    <th className="px-4 py-3">출판사</th>
                    <th className="px-4 py-3">ISBN</th>
                    <th className="px-4 py-3">학교 도서 코드</th>
                    <th className="px-4 py-3">소장</th>
                    <th className="px-4 py-3">위치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {books.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>
                        -
                      </td>
                    </tr>
                  ) : (
                    books.map((book) => (
                      <tr key={book.id}>
                        <td className="max-w-[260px] px-4 py-3 font-medium text-gray-900">
                          {displayValue(book.title)}
                        </td>
                        <td className="px-4 py-3">{displayValue(book.author)}</td>
                        <td className="px-4 py-3">{displayValue(book.publisher)}</td>
                        <td className="px-4 py-3">{displayValue(book.isbn)}</td>
                        <td className="px-4 py-3">{displayValue(book.school_book_code)}</td>
                        <td className="px-4 py-3">
                          {book.available_copies} / {book.total_copies}
                        </td>
                        <td className="px-4 py-3">{displayValue(book.location)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div id="remove-books" ref={removePanelRef} className="mt-8 scroll-mt-24">
          <AdminRemoveBookPanel
            books={books}
            isLoading={isLoading}
            onBookDeleted={(bookId) => {
              setBooks((current) => current.filter((book) => book.id !== bookId))
            }}
          />
        </div>
      </div>
    </section>
  )
}
