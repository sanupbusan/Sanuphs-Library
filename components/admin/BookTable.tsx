'use client'

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { displayValue } from '@/lib/shared/display'
import { displaySchoolBookCodes } from '@/services/book-code.service'
import type { AdminBookUpdateInput } from '@/services/book-input.service'
import type { AdminBookRow } from '@/types/library'
import type { AdminBookEditField } from '@/components/admin/useAdminBooks'

type BookTableProps = {
  books: AdminBookRow[]
  deletingBookId: string | null
  editingBookId: string | null
  editInput: AdminBookUpdateInput | null
  savingBookId: string | null
  onCancelEdit: () => void
  onDeleteBook: (book: AdminBookRow) => void
  onSaveEdit: (book: AdminBookRow) => void
  onStartEdit: (book: AdminBookRow) => void
  onUpdateEditField: (field: AdminBookEditField, value: string) => void
}

const editInputClassName =
  'h-9 w-full min-w-[120px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-wait disabled:bg-gray-50 disabled:text-gray-400'

export default function BookTable({
  books,
  deletingBookId,
  editingBookId,
  editInput,
  savingBookId,
  onCancelEdit,
  onDeleteBook,
  onSaveEdit,
  onStartEdit,
  onUpdateEditField,
}: BookTableProps) {
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
        onChange={(event) => onUpdateEditField(field, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSaveEdit(book)
          }

          if (event.key === 'Escape') {
            onCancelEdit()
          }
        }}
        type="text"
        value={editInput[field]}
      />
    )
  }

  return (
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
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
                            disabled={isSaving}
                            onClick={() => onSaveEdit(book)}
                            type="button"
                          >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            저장
                          </button>
                          <button
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
                            disabled={isSaving}
                            onClick={onCancelEdit}
                            type="button"
                          >
                            <X className="h-3.5 w-3.5" />
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
                            disabled={areActionsDisabled}
                            onClick={() => onStartEdit(book)}
                            type="button"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            수정
                          </button>
                          <button
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:border-red-200 hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
                            disabled={areActionsDisabled}
                            onClick={() => onDeleteBook(book)}
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
  )
}
