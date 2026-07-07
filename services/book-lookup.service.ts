import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { DbClient } from '@/lib/db'
import type { BookLookupResult } from '@/types/library'
import * as bookRepository from '@/repositories/book.repository'

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
