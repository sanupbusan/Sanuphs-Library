import { ApiRouteError } from '@/lib/api-route'
import {
  getMissingAdminBookRequiredFieldsMessage,
  getNullableAdminBookIsbn,
  type AdminBookCreateInput,
  type AdminBookUpdateInput,
} from '@/lib/admin-book-input'
import { addSchoolBookCode } from '@/lib/school-book-codes'
import type { DbClient } from '@/lib/db'
import type { AdminBookRow, BookRow } from '@/types/library'
import * as bookRepository from '@/repositories/book.repository'

export const ADMIN_BOOK_COLUMNS =
  'id, isbn, school_book_code, school_book_codes, title, author, publisher, category, total_copies, available_copies, created_at'

export const ADMIN_BOOK_EXPORT_COLUMNS =
  'id, title, author, publisher, isbn, school_book_code, category, total_copies, available_copies'

export const ADMIN_BOOK_EXPORT_FIELD_ORDER = [
  'id',
  'title',
  'author',
  'publisher',
  'isbn',
  'school_book_code',
  'category',
  'total_copies',
  'available_copies',
] as const satisfies readonly (keyof BookRow)[]

export const ADMIN_BOOK_EXCEL_HEADERS: Record<(typeof ADMIN_BOOK_EXPORT_FIELD_ORDER)[number], string> = {
  id: 'ID',
  title: '도서명',
  author: '저자',
  publisher: '출판사',
  isbn: 'ISBN',
  school_book_code: '학교 도서 코드',
  category: '분류',
  total_copies: '총 권수',
  available_copies: '대출 가능 권수',
}

export const ADMIN_BOOK_IMPORT_HEADER_TO_FIELD: Record<string, keyof BookRow> = {
  ID: 'id',
  ISBN: 'isbn',
  id: 'id',
  isbn: 'isbn',
  publisher: 'publisher',
  school_book_code: 'school_book_code',
  title: 'title',
  total_copies: 'total_copies',
  available_copies: 'available_copies',
  author: 'author',
  category: 'category',
  도서명: 'title',
  분류: 'category',
  저자: 'author',
  출판사: 'publisher',
  '총 권수': 'total_copies',
  '학교 도서 코드': 'school_book_code',
  '대출 가능 권수': 'available_copies',
}

export const ADMIN_BOOK_IMPORT_BATCH_SIZE = 200

const DEFAULT_BOOK_CATEGORY = '미분류'

function duplicateBookCodeError() {
  return new ApiRouteError(409, 'DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 도서 코드입니다.')
}

function getDbErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''
}

type AdminBookListCacheEntry = {
  books: AdminBookRow[]
  expiresAt: number
}

const ADMIN_BOOK_LIST_CACHE_TTL_MS = 5_000
let adminBookListCache: AdminBookListCacheEntry | null = null
let adminBookListCachePromise: Promise<AdminBookRow[]> | null = null

function cloneAdminBooks(books: AdminBookRow[]) {
  return books.map((book) => ({ ...book }))
}

export function invalidateAdminBooksCache() {
  adminBookListCache = null
  adminBookListCachePromise = null
}

export type CreateAdminBookInput = {
  author: string
  isbn: string
  publisher: string
  schoolBookCode: string
  title: string
}

export type ImportAdminBookInput = {
  author: string
  available_copies?: number
  category?: string
  isbn?: string | null
  publisher?: string | null
  school_book_code?: string | null
  title: string
  total_copies?: number
}

export type ImportAdminBookRow = {
  book: ImportAdminBookInput
  rowNumber: number
}

export type ImportAdminBookError = {
  message: string
  row: number
}

export type ImportAdminBooksResult = {
  errors: ImportAdminBookError[]
  inserted: number
  skipped: number
}

export async function insertAdminBook(db: DbClient, input: CreateAdminBookInput): Promise<AdminBookRow> {
  try {
    const book = await bookRepository.insertAdminBook(db, {
      author: input.author,
      available_copies: 1,
      category: DEFAULT_BOOK_CATEGORY,
      isbn: input.isbn,
      publisher: input.publisher,
      school_book_code: input.schoolBookCode,
      school_book_codes: [input.schoolBookCode],
      title: input.title,
      total_copies: 1,
    })

    invalidateAdminBooksCache()
    return book
  } catch (error) {
    if (getDbErrorCode(error) === '23505') {
      throw duplicateBookCodeError()
    }
    throw error
  }
}

export async function listAdminBooks(db: DbClient): Promise<AdminBookRow[]> {
  const now = Date.now()

  if (adminBookListCache && adminBookListCache.expiresAt > now) {
    return cloneAdminBooks(adminBookListCache.books)
  }

  if (!adminBookListCachePromise) {
    adminBookListCachePromise = bookRepository.listAdminBooks(db)
      .then((books) => {
        adminBookListCache = {
          books,
          expiresAt: Date.now() + ADMIN_BOOK_LIST_CACHE_TTL_MS,
        }

        return books
      })
      .finally(() => {
        adminBookListCachePromise = null
      })
  }

  return cloneAdminBooks(await adminBookListCachePromise)
}

export async function listAdminBooksForExport(db: DbClient): Promise<BookRow[]> {
  return bookRepository.listAdminBooksForExport(db)
}

async function addImportedCopiesToExistingBook(
  db: DbClient,
  existingBook: AdminBookRow,
  book: ImportAdminBookInput
) {
  const schoolBookCode = book.school_book_code?.trim() || null
  const totalCopies = book.total_copies ?? 1
  const availableCopies = book.available_copies ?? totalCopies

  try {
    await bookRepository.updateBookCopiesAndCodes(db, {
      available_copies: existingBook.available_copies + availableCopies,
      id: existingBook.id,
      school_book_code: existingBook.school_book_code || schoolBookCode,
      school_book_codes: schoolBookCode ? addSchoolBookCode(existingBook, schoolBookCode) : existingBook.school_book_codes,
      total_copies: existingBook.total_copies + totalCopies,
    })
  } catch (error) {
    if (getDbErrorCode(error) === '23505') {
      throw duplicateBookCodeError()
    }
    throw error
  }
}

async function insertImportedBook(db: DbClient, book: ImportAdminBookInput) {
  const schoolBookCode = book.school_book_code?.trim() || null
  const totalCopies = book.total_copies ?? 1
  const availableCopies = book.available_copies ?? totalCopies

  try {
    await bookRepository.insertAdminBook(db, {
      author: book.author,
      available_copies: availableCopies,
      category: book.category || DEFAULT_BOOK_CATEGORY,
      isbn: book.isbn ?? null,
      publisher: book.publisher ?? null,
      school_book_code: schoolBookCode,
      school_book_codes: schoolBookCode ? [schoolBookCode] : [],
      title: book.title,
      total_copies: totalCopies,
    })
  } catch (error) {
    if (getDbErrorCode(error) === '23505') {
      throw duplicateBookCodeError()
    }
    throw error
  }
}

async function importAdminBookRow(db: DbClient, row: ImportAdminBookRow) {
  const schoolBookCode = row.book.school_book_code?.trim() || null

  if (schoolBookCode) {
    const existingBookWithSchoolBookCode = await bookRepository.findBookBySchoolBookCode(db, schoolBookCode)

    if (existingBookWithSchoolBookCode) {
      return 'skipped' as const
    }
  }

  if (row.book.isbn) {
    const existingBookWithIsbn = await bookRepository.findBookByIsbn(db, row.book.isbn)

    if (existingBookWithIsbn) {
      await addImportedCopiesToExistingBook(db, existingBookWithIsbn, row.book)
      return 'inserted' as const
    }
  }

  await insertImportedBook(db, row.book)
  return 'inserted' as const
}

async function insertAdminBookImportBatch(
  db: DbClient,
  rows: ImportAdminBookRow[]
): Promise<ImportAdminBooksResult> {
  let inserted = 0
  let skipped = 0
  const errors: ImportAdminBookError[] = []

  for (const row of rows) {
    try {
      const result = await importAdminBookRow(db, row)
      if (result === 'skipped') {
        skipped += 1
      } else {
        inserted += 1
      }
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : '도서 추가 중 오류가 발생했습니다.',
        row: row.rowNumber,
      })
    }
  }

  return { errors, inserted, skipped }
}

export async function insertAdminBooksInBatches(
  db: DbClient,
  rows: ImportAdminBookRow[]
): Promise<ImportAdminBooksResult> {
  let inserted = 0
  let skipped = 0
  const errors: ImportAdminBookError[] = []

  for (let index = 0; index < rows.length; index += ADMIN_BOOK_IMPORT_BATCH_SIZE) {
    const batch = rows.slice(index, index + ADMIN_BOOK_IMPORT_BATCH_SIZE)
    const result = await insertAdminBookImportBatch(db, batch)
    inserted += result.inserted
    skipped += result.skipped
    errors.push(...result.errors)
  }

  if (inserted > 0) {
    invalidateAdminBooksCache()
  }

  return { errors, inserted, skipped }
}

export async function deleteAdminBook(db: DbClient, bookId: string) {
  if (!bookId) {
    throw new ApiRouteError(400, 'MISSING_BOOK_ID', '제거할 도서를 선택해주세요.')
  }

  try {
    const deletedBook = await bookRepository.deleteAdminBook(db, bookId)
    if (!deletedBook) {
      throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '제거할 도서를 찾을 수 없습니다.')
    }

    invalidateAdminBooksCache()
    return deletedBook
  } catch (error) {
    if (getDbErrorCode(error) === '23503') {
      throw new ApiRouteError(409, 'BOOK_HAS_LOANS', '대출 기록이 있는 도서는 바로 제거할 수 없습니다.')
    }
    throw error
  }
}

export async function createAdminBook(db: DbClient, input: AdminBookCreateInput): Promise<AdminBookRow> {
  const missingFieldsMessage = getMissingAdminBookRequiredFieldsMessage(input)
  if (missingFieldsMessage) {
    throw new ApiRouteError(400, 'MISSING_REQUIRED_FIELDS', missingFieldsMessage)
  }

  const bookWithSchoolBookCode = await bookRepository.findBookBySchoolBookCode(db, input.schoolBookCode)
  if (bookWithSchoolBookCode) {
    throw duplicateBookCodeError()
  }

  const isbn = getNullableAdminBookIsbn(input)
  if (isbn) {
    const existingBook = await bookRepository.findBookByIsbn(db, isbn)
    if (existingBook) {
      try {
        const updatedBook = await bookRepository.updateBookCopiesAndCodes(db, {
          available_copies: existingBook.available_copies + 1,
          id: existingBook.id,
          school_book_code: existingBook.school_book_code || input.schoolBookCode,
          school_book_codes: addSchoolBookCode(existingBook, input.schoolBookCode),
          total_copies: existingBook.total_copies + 1,
        })

        if (!updatedBook) {
          throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '수정할 도서를 찾을 수 없습니다.')
        }

        invalidateAdminBooksCache()
        return updatedBook
      } catch (error) {
        if (getDbErrorCode(error) === '23505') {
          throw duplicateBookCodeError()
        }
        throw error
      }
    }
  }

  return insertAdminBook(db, {
    author: input.author,
    isbn: isbn ?? '',
    publisher: input.publisher,
    schoolBookCode: input.schoolBookCode,
    title: input.title,
  })
}

export async function updateAdminBook(
  db: DbClient,
  bookId: string,
  input: AdminBookUpdateInput
): Promise<AdminBookRow> {
  if (!bookId) {
    throw new ApiRouteError(400, 'MISSING_BOOK_ID', '수정할 도서를 선택해주세요.')
  }

  const missingFieldsMessage = getMissingAdminBookRequiredFieldsMessage(input)
  if (missingFieldsMessage) {
    throw new ApiRouteError(400, 'MISSING_REQUIRED_FIELDS', missingFieldsMessage)
  }

  try {
    const updatedBook = await bookRepository.updateAdminBook(db, bookId, {
      author: input.author,
      isbn: getNullableAdminBookIsbn(input),
      publisher: input.publisher,
      schoolBookCode: input.schoolBookCode,
      title: input.title,
    })

    if (!updatedBook) {
      throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '수정할 도서를 찾을 수 없습니다.')
    }

    invalidateAdminBooksCache()
    return updatedBook
  } catch (error) {
    if (getDbErrorCode(error) === '23505') {
      throw duplicateBookCodeError()
    }
    throw error
  }
}
