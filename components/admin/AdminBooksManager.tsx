'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'

type BookRow = {
  author: string
  available_copies: number
  category: string
  created_at: string
  id: string
  isbn: string | null
  location: string | null
  publisher: string | null
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
  const [books, setBooks] = useState<BookRow[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

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
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서관리</h1>
            <p className="mt-1 text-sm text-gray-600">등록된 도서 현황</p>
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
                    <th className="px-4 py-3">분류</th>
                    <th className="px-4 py-3">소장</th>
                    <th className="px-4 py-3">위치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {books.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
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
                        <td className="px-4 py-3">{displayValue(book.category)}</td>
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
      </div>
    </section>
  )
}
