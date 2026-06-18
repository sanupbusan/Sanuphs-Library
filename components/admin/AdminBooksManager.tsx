'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { BookOpen, Download, Plus, Trash2, Upload } from 'lucide-react'
import AdminRemoveBookPanel from '@/components/admin/AdminRemoveBookPanel'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { deleteBookAction, updateBookAction } from '@/app/admin/books/actions'
import { removeAdminBookById, replaceUpdatedAdminBook } from '@/components/admin/adminBookListState'
import { useToast } from '@/components/ui/ToastProvider'
import { displayValue } from '@/lib/display'
import { displaySchoolBookCodes } from '@/lib/school-book-codes'
import type { AdminBookUpdateInput } from '@/lib/admin-book-input'
import type { AdminBookRow } from '@/types/library'

type AdminBooksManagerProps = {
  initialBooks: AdminBookRow[]
}

type AdminBookEditField = keyof AdminBookUpdateInput

const editInputClassName =
  'h-9 w-full min-w-[120px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-wait disabled:bg-gray-50 disabled:text-gray-400'

function getBookEditInput(book: AdminBookRow): AdminBookUpdateInput {
  return {
    author: book.author ?? '',
    isbn: book.isbn ?? '',
    location: book.location ?? '',
    publisher: book.publisher ?? '',
    schoolBookCode: book.school_book_code ?? '',
    title: book.title ?? '',
  }
}

export default function AdminBooksManager({ initialBooks }: AdminBooksManagerProps) {
  const removePanelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    setBooks(initialBooks)
  }, [initialBooks])

  function startEditingBook(book: AdminBookRow) {
    if (savingBookId) {
      return
    }

    setEditingBookId(book.id)
    setEditInput(getBookEditInput(book))
    setEditError('')
  }

  function cancelEditingBook() {
    if (savingBookId) {
      return
    }

    setEditingBookId(null)
    setEditInput(null)
    setEditError('')
  }

  function updateEditField(field: AdminBookEditField, value: string) {
    setEditError('')
    setEditInput((current) => current ? { ...current, [field]: value } : current)
  }

  async function saveBookEdit(book: AdminBookRow) {
    if (!editInput || savingBookId) {
      return
    }

    setSavingBookId(book.id)
    setEditError('')

    try {
      const result = await updateBookAction(book.id, editInput)

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? '도서 정보 수정에 실패했습니다.')
      }

      const updatedBook = result.data

      setBooks((current) => replaceUpdatedAdminBook(current, updatedBook))
      setEditingBookId(null)
      setEditInput(null)
      addToast(`"${updatedBook.title}" 도서 정보를 수정했습니다.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '도서 정보 수정에 실패했습니다.'
      setEditError(message)
      addToast(message, 'error')
    } finally {
      setSavingBookId(null)
    }
  }

  async function deleteBook(book: AdminBookRow) {
    if (deletingBookId || savingBookId) {
      return
    }

    const confirmed = window.confirm(`"${book.title}" 도서를 제거할까요? 이 작업은 되돌릴 수 없습니다.`)

    if (!confirmed) {
      return
    }

    setDeletingBookId(book.id)
    setEditError('')

    try {
      const result = await deleteBookAction(book.id)

      if (result.error) {
        throw new Error(result.error.message)
      }

      setBooks((current) => removeAdminBookById(current, book.id))
      addToast(`"${result.data?.title ?? book.title}" 도서를 제거했습니다.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '도서 제거에 실패했습니다.'
      setEditError(message)
      addToast(message, 'error')
    } finally {
      setDeletingBookId(null)
    }
  }

  function renderEditInput(book: AdminBookRow, field: AdminBookEditField, label: string) {
    if (editingBookId !== book.id || !editInput) {
      return null
    }

    const isSaving = savingBookId === book.id

    return (
      <input
        aria-label={`${label} 수정`}
        className={editInputClassName}
        disabled={isSaving}
        onChange={(event) => updateEditField(field, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void saveBookEdit(book)
          }

          if (event.key === 'Escape') {
            cancelEditingBook()
          }
        }}
        type="text"
        value={editInput[field]}
      />
    )
  }

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

        {editError ? (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {editError}
          </div>
        ) : null}

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

      </div>
    </section>
  )
}
