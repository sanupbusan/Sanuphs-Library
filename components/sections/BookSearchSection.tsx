'use client'

import { FormEvent, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import type { SearchBook } from '@/lib/library-queries'
import { cn } from '@/lib/utils'

type SearchResponse = {
  data?: SearchBook[]
  error?: {
    code: string
    message: string
  }
}

const emptyResults: SearchBook[] = []

function ResultRows({ books }: { books: SearchBook[] }) {
  if (books.length === 0) {
    return (
      <tr>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">-</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">-</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">-</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">-</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">-</td>
      </tr>
    )
  }

  return books.map((book) => (
    <tr key={book.id} className="hover:bg-gray-50/70">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{book.title}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{book.author}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{book.category}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
        {book.available_copies}/{book.total_copies}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{book.location ?? '-'}</td>
    </tr>
  ))
}

export default function BookSearchSection() {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<SearchBook[]>(emptyResults)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsLoading(true)
    setErrorMessage('')

    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20',
      })
      const response = await fetch(`/api/books/search?${params.toString()}`)
      const payload = (await response.json()) as SearchResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '도서 검색에 실패했습니다.')
      }

      setBooks(payload.data ?? [])
    } catch (error) {
      setBooks(emptyResults)
      setErrorMessage(error instanceof Error ? error.message : '도서 검색에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section id="search" className="scroll-mt-20 bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서 검색</h2>
          </div>

          <form onSubmit={handleSearch} className="flex w-full gap-2 sm:max-w-xl">
            <label htmlFor="book-search-query" className="sr-only">
              도서 검색어
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="book-search-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                maxLength={100}
                placeholder="제목, 저자, 카테고리"
                type="search"
              />
            </div>
            <button
              type="submit"
              className={cn(
                'inline-flex h-11 min-w-24 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700',
                isLoading && 'cursor-wait opacity-80'
              )}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              검색
            </button>
          </form>
        </div>

        {errorMessage ? (
          <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500">도서명</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500">저자</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500">대여가능</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500">위치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <ResultRows books={books} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
