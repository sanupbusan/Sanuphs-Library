'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Search, Trash2 } from 'lucide-react'
import { deleteBookAction } from '@/app/admin/books/actions'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import { displayValue } from '@/lib/display'
import type { RemovableBook } from '@/types/library'

type AdminRemoveBookPanelProps = {
  books: RemovableBook[]
  isLoading?: boolean
  onBookDeleted?: (bookId: string) => void
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

function getBarcodeCandidate(value: string) {
  return normalizeBarcodeInput(value)
}

function getIsbnCandidate(value: string) {
  return normalizeIsbnInput(value)
}

function isLikelyBarcode(value: string) {
  const barcode = getBarcodeCandidate(value)

  return barcode.length >= 4 && /^[0-9A-Za-z-]+$/.test(barcode)
}

function isLikelyIsbnBarcode(value: string) {
  const isbn = getIsbnCandidate(value)

  return isbn.length === 10 || isbn.length === 13
}

function getAddBookUrl(scannedCode: string) {
  const params = new URLSearchParams()

  if (isLikelyIsbnBarcode(scannedCode)) {
    params.set('isbn', getIsbnCandidate(scannedCode))
  } else {
    params.set('schoolBookCode', getBarcodeCandidate(scannedCode))
  }

  return `/admin/add_books?${params.toString()}#add-book-form`
}

export default function AdminRemoveBookPanel({
  books,
  isLoading = false,
  onBookDeleted,
}: AdminRemoveBookPanelProps) {
  const [localBooks, setLocalBooks] = useState<RemovableBook[]>(books)
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)

  useEffect(() => {
    setLocalBooks(books)
  }, [books])

  const isPanelLoading = isLoading
  const filteredBooks = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const barcodeKeyword = normalizeBarcodeInput(query).toLowerCase()

    if (!keyword) {
      return localBooks
    }

    return localBooks.filter((book) =>
      [
        book.title,
        book.author,
        book.publisher,
        book.isbn,
        book.school_book_code,
      ].some((value) => normalize(value).includes(keyword) || (!!barcodeKeyword && normalize(value).includes(barcodeKeyword)))
    )
  }, [query, localBooks])

  async function deleteBook(book: RemovableBook) {
    const confirmed = window.confirm(`"${book.title}" 도서를 제거할까요? 이 작업은 되돌릴 수 없습니다.`)

    if (!confirmed) {
      return
    }

    setDeletingBookId(book.id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await deleteBookAction(book.id)

      if (result.error) {
        throw new Error(result.error.message)
      }

      setLocalBooks((current) => current.filter((item) => item.id !== book.id))
      onBookDeleted?.(book.id)
      setSuccessMessage(`"${result.data?.title ?? book.title}" 도서를 제거했습니다.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '도서 제거에 실패했습니다.')
    } finally {
      setDeletingBookId(null)
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isPanelLoading || filteredBooks.length > 0 || !isLikelyBarcode(query)) {
      return
    }

    window.location.assign(getAddBookUrl(query))
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">책 제거</h2>
          <p className="mt-1 text-sm text-gray-600">
            학교 도서 코드, ISBN, 책 이름으로 찾은 뒤 등록된 도서를 제거합니다.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" />
          대여 기록이 있는 책은 삭제되지 않을 수 있습니다.
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4">
        <label htmlFor="remove-book-query" className="sr-only">
          제거할 책 검색
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="remove-book-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            placeholder="학교 도서 코드, ISBN, 책 이름"
            type="search"
          />
        </div>
      </form>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      {isPanelLoading ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">도서명</th>
                <th className="px-4 py-3">저자</th>
                <th className="px-4 py-3">학교 도서 코드</th>
                <th className="px-4 py-3">ISBN</th>
                <th className="px-4 py-3">소장</th>
                <th className="px-4 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredBooks.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                    -
                  </td>
                </tr>
              ) : (
                filteredBooks.map((book) => (
                  <tr key={book.id}>
                    <td className="max-w-[260px] px-4 py-3 font-medium text-gray-900">
                      {displayValue(book.title)}
                    </td>
                    <td className="px-4 py-3">{displayValue(book.author)}</td>
                    <td className="px-4 py-3">{displayValue(book.school_book_code)}</td>
                    <td className="px-4 py-3">{displayValue(book.isbn)}</td>
                    <td className="px-4 py-3">
                      {book.available_copies} / {book.total_copies}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:border-red-200 hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
                        disabled={deletingBookId === book.id}
                        onClick={() => {
                          void deleteBook(book)
                        }}
                        type="button"
                      >
                        {deletingBookId === book.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        제거
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
