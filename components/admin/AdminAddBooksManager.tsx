'use client'

import { useEffect, useState } from 'react'
import { prependCreatedAdminBook, removeAdminBookById } from '@/components/admin/adminBookListState'
import AdminAddBookForm from '@/components/admin/AdminAddBookForm'
import AdminRemoveBookPanel from '@/components/admin/AdminRemoveBookPanel'
import type { AdminBookRow } from '@/types/library'

type AdminAddBooksManagerProps = {
  initialBooks: AdminBookRow[]
}

export default function AdminAddBooksManager({ initialBooks }: AdminAddBooksManagerProps) {
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks)

  useEffect(() => {
    setBooks(initialBooks)
  }, [initialBooks])

  return (
    <>
      <AdminAddBookForm
        onBookCreated={(book) => {
          setBooks((current) => prependCreatedAdminBook(current, book))
        }}
      />
      <section id="remove-books" className="bg-gray-50 pb-14 sm:pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <AdminRemoveBookPanel
            books={books}
            onBookDeleted={(bookId) => {
              setBooks((current) => removeAdminBookById(current, bookId))
            }}
          />
        </div>
      </section>
    </>
  )
}
