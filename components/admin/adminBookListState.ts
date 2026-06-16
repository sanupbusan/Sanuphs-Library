import type { AdminBookRow } from '@/types/library'

export function prependCreatedAdminBook(books: AdminBookRow[], createdBook: AdminBookRow) {
  return [createdBook, ...books.filter((book) => book.id !== createdBook.id)].slice(0, 100)
}

export function removeAdminBookById(books: AdminBookRow[], bookId: string) {
  return books.filter((book) => book.id !== bookId)
}
