'use client'

import { useEffect, useMemo, useState } from 'react'
import { deleteBookAction, updateBookAction } from '@/app/admin/books/actions'
import { removeAdminBookById, replaceUpdatedAdminBook } from '@/components/admin/adminBookListState'
import { useToast } from '@/components/ui/ToastProvider'
import type { AdminBookUpdateInput } from '@/lib/admin-book-input'
import { displaySchoolBookCodes } from '@/lib/school-book-codes'
import type { AdminBookRow } from '@/types/library'

export type AdminBookEditField = keyof AdminBookUpdateInput

function getBookEditInput(book: AdminBookRow): AdminBookUpdateInput {
  return {
    author: book.author ?? '',
    isbn: book.isbn ?? '',
    publisher: book.publisher ?? '',
    schoolBookCode: book.school_book_code ?? '',
    title: book.title ?? '',
  }
}

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

function matchesBookSearch(book: AdminBookRow, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [
    book.title,
    book.author,
    book.publisher,
    book.isbn,
    book.school_book_code,
    displaySchoolBookCodes(book),
  ].some((value) => normalizeSearchValue(value).includes(normalizedQuery))
}

export function useAdminBooks(initialBooks: AdminBookRow[]) {
  const { addToast } = useToast()
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState<AdminBookUpdateInput | null>(null)
  const [editError, setEditError] = useState('')
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)
  const [savingBookId, setSavingBookId] = useState<string | null>(null)

  useEffect(() => {
    setBooks(initialBooks)
  }, [initialBooks])

  const filteredBooks = useMemo(
    () => books.filter((book) => matchesBookSearch(book, searchQuery)),
    [books, searchQuery]
  )

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
    setEditInput((current) => (current ? { ...current, [field]: value } : current))
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

  return {
    books: filteredBooks,
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
  }
}
