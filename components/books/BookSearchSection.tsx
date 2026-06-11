'use client'

import { FormEvent, useEffect, useState } from 'react'
import { BookOpen, Loader2, Search } from 'lucide-react'

type BookSearchResult = {
  author: string
  available_copies: number
  category: string
  id: string
  isbn: string | null
  location: string | null
  publisher: string | null
  title: string
  total_copies: number
}

type BookSearchResponse = {
  data?: BookSearchResult[]
  error?: {
    code: string
    message: string
  }
  meta?: {
    count: number
    limit: number
    query: string
  }
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

export default function BookSearchSection() {
  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  async function searchBooks(nextQuery: string) {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const params = new URLSearchParams({
        limit: '20',
        q: nextQuery,
      })
      const response = await fetch(`/api/books/search?${params.toString()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as BookSearchResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '도서 검색에 실패했습니다.')
      }

      setBooks(payload.data ?? [])
      setSubmittedQuery(nextQuery)
    } catch (error) {
      setBooks([])
      setErrorMessage(error instanceof Error ? error.message : '도서 검색에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void searchBooks('')
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void searchBooks(query.trim())
  }

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서 검색</h1>
            <p className="mt-1 text-sm text-gray-600">제목, 저자, 분류로 도서를 검색합니다.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="book-search-query">
            도서 검색어
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="book-search-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="도서명, 저자, 분류"
              type="search"
            />
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            검색
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <BookOpen className="h-4 w-4 text-primary-600" />
              검색 결과
            </div>
            <div className="text-xs text-gray-500">
              {submittedQuery ? `"${submittedQuery}"` : '전체'} · {books.length}건
            </div>
          </div>

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
                    <th className="px-4 py-3">대여 가능</th>
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
                        <td className="max-w-[280px] px-4 py-3 font-medium text-gray-900">
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
