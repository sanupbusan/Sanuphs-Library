'use client'

import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'
import BookSearchFilter from '@/components/admin/BookSearchFilter'
import BookTable from '@/components/admin/BookTable'
import ExcelImportModal from '@/components/admin/ExcelImportModal'
import { useAdminBooks } from '@/components/admin/useAdminBooks'
import type { AdminBookRow } from '@/types/library'

type AdminBooksManagerProps = {
  initialBooks: AdminBookRow[]
}

export default function AdminBooksManager({ initialBooks }: AdminBooksManagerProps) {
  const {
    books,
    cancelEditingBook,
    deleteBook,
    deletingBookId,
    editError,
    editingBookId,
    editInput,
    saveBookEdit,
    savingBookId,
    searchQuery,
    setSearchQuery,
    startEditingBook,
    updateEditField,
  } = useAdminBooks(initialBooks)

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서관리</h1>
              <p className="mt-1 text-sm text-gray-600">등록된 도서 현황</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <BookSearchFilter searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />
            <ExcelImportModal />
            <Link
              href="/admin/add_books"
              className="inline-flex h-10 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
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

        <BookTable
          books={books}
          deletingBookId={deletingBookId}
          editingBookId={editingBookId}
          editInput={editInput}
          savingBookId={savingBookId}
          onCancelEdit={cancelEditingBook}
          onDeleteBook={(book) => {
            void deleteBook(book)
          }}
          onSaveEdit={(book) => {
            void saveBookEdit(book)
          }}
          onStartEdit={startEditingBook}
          onUpdateEditField={updateEditField}
        />
      </div>
    </section>
  )
}
