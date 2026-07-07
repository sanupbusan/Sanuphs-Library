import type { DbClient } from '@/lib/db'
import type { SearchBook } from '@/types/library'
import * as bookRepository from '@/repositories/book.repository'

export async function searchBooks(db: DbClient, query: string, limit = 20): Promise<SearchBook[]> {
  return bookRepository.searchBooks(db, query, limit)
}
