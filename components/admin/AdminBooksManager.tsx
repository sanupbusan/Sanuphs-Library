'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { BookOpen, Download, Plus, Trash2, Upload } from 'lucide-react'
import AdminRemoveBookPanel from '@/components/admin/AdminRemoveBookPanel'
import { displayValue } from '@/lib/display'
import type { AdminBookRow } from '@/types/library'

type AdminBooksManagerProps = {
  initialBooks: AdminBookRow[]
}

export default function AdminBooksManager({ initialBooks }: AdminBooksManagerProps) {
  const removePanelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks)
  const [isImporting, setIsImporting] = useState(false)

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
    setBooks(initialBooks)
  }, [initialBooks])

  function handleDownloadExcel() {
    window.location.href = '/api/admin/books/export'
  }

  function handleOpenImportPicker() {
    if (isImporting) {
      return
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setIsImporting(true)

    try {
      const response = await fetch('/api/admin/books/import', {
        body: formData,
        method: 'POST',
      })

      const result = (await response.json()) as {
        data?: {
          errors: Array<{ message: string; row: number }>
          failed: number
          inserted: number
        }
        error?: {
          message?: string
        }
      }

      if (!response.ok || !result.data) {
        throw new Error(result.error?.message || '엑셀 업로드에 실패했습니다.')
      }

      const { errors, failed, inserted } = result.data
      const detailMessage = errors
        .slice(0, 5)
        .map((error) => `${error.row}행: ${error.message}`)
        .join('\n')
      const message = [`추가된 도서: ${inserted}권`, `실패한 행: ${failed}건`, detailMessage]
        .filter(Boolean)
        .join('\n')

      window.alert(message)

      if (inserted > 0) {
        window.setTimeout(() => {
          window.location.reload()
        }, 150)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '엑셀 업로드에 실패했습니다.'
      window.alert(message)
    } finally {
      setIsImporting(false)
    }
  }

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
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImportFileChange}
            />

            <Link
              href="#remove-books"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              기존 책 제거
            </Link>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary-100 bg-white px-4 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <Download className="h-4 w-4" />
              엑셀 다운로드
            </button>

            <button
              type="button"
              onClick={handleOpenImportPicker}
              disabled={isImporting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? '업로드 중...' : '엑셀로 추가'}
            </button>

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
                      <td className="px-4 py-3">{displayValue(book.isbn)}</td>
                      <td className="px-4 py-3">{displayValue(book.school_book_code)}</td>
                      <td className="px-4 py-3">
                        {book.available_copies} / {book.total_copies}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="remove-books" ref={removePanelRef} className="mt-8 scroll-mt-24">
          <AdminRemoveBookPanel
            books={books}
            onBookDeleted={(bookId) => {
              setBooks((current) => current.filter((book) => book.id !== bookId))
            }}
          />
        </div>
      </div>
    </section>
  )
}
