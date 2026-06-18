'use client'

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
  const { addToast } = useToast()
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks)
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState<AdminBookUpdateInput | null>(null)
  const [editError, setEditError] = useState('')
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)
  const [savingBookId, setSavingBookId] = useState<string | null>(null)

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
                  <th className="whitespace-nowrap px-4 py-3">소장</th>
                  <th className="px-4 py-3 text-right">작업</th>
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
                  books.map((book) => {
                    const isEditing = editingBookId === book.id
                    const isDeleting = deletingBookId === book.id
                    const isSaving = savingBookId === book.id
                    const areActionsDisabled = Boolean(savingBookId || deletingBookId)

                    return (
                      <tr key={book.id} className={isEditing ? 'bg-primary-50/30' : undefined}>
                        <td className="max-w-[260px] px-4 py-3 font-medium text-gray-900">
                          {isEditing ? renderEditInput(book, 'title', '도서명') : displayValue(book.title)}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? renderEditInput(book, 'author', '저자') : displayValue(book.author)}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? renderEditInput(book, 'publisher', '출판사') : displayValue(book.publisher)}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? renderEditInput(book, 'isbn', 'ISBN') : displayValue(book.isbn)}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing
                            ? renderEditInput(book, 'schoolBookCode', '학교 도서 코드')
                            : displayValue(displaySchoolBookCodes(book))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {book.available_copies} / {book.total_copies}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
                                disabled={isSaving}
                                onClick={() => {
                                  void saveBookEdit(book)
                                }}
                                type="button"
                              >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                저장
                              </button>
                              <button
                                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
                                disabled={isSaving}
                                onClick={cancelEditingBook}
                                type="button"
                              >
                                <X className="h-3.5 w-3.5" />
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
                                disabled={areActionsDisabled}
                                onClick={() => startEditingBook(book)}
                                type="button"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                수정
                              </button>
                              <button
                                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:border-red-200 hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
                                disabled={areActionsDisabled}
                                onClick={() => {
                                  void deleteBook(book)
                                }}
                                type="button"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                책 제거
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  )
}
