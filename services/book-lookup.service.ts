import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/shared/barcode'
import type { DbClient } from '@/lib/db'
import type { BookLookupResult } from '@/types/library'
import * as bookRepository from '@/repositories/book.repository'

export type NormalizedBookInfo = {
  author: string
  isbn: string
  publisher: string
  title: string
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeCode(value: string) {
  return normalizeBarcodeInput(value).toUpperCase()
}

function isLikelyIsbn(value: string) {
  const digits = value.replace(/[^0-9Xx]/g, '')
  return digits.length === 10 || digits.length === 13
}

export async function lookupBookByBarcodeOrIsbn(
  db: DbClient,
  rawCode: string
): Promise<BookLookupResult | null> {
  const normalizedCode = normalizeCode(rawCode)
  const isIsbn = isLikelyIsbn(normalizedCode)
  const data = await bookRepository.findRemovableBookByCode(db, normalizedCode, isIsbn)

  if (!data) {
    return null
  }

  return {
    ...data,
    matched_school_book_code: isIsbn
      ? data.school_book_code ?? data.school_book_codes?.[0] ?? null
      : normalizedCode,
  }
}

export async function lookupStoredBookByIsbn(
  db: DbClient,
  isbn: string
): Promise<NormalizedBookInfo | null> {
  const book = await bookRepository.findStoredBookInfoByIsbn(db, isbn)
  if (!book) {
    return null
  }

  const title = cleanText(book.title)
  const author = cleanText(book.author)
  const publisher = cleanText(book.publisher)

  if (!title && !author && !publisher) {
    return null
  }

  return {
    author,
    isbn: normalizeIsbnInput(cleanText(book.isbn)) || isbn,
    publisher,
    title,
  }
}
