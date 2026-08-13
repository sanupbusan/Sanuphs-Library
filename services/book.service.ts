import { ApiRouteError } from '@/lib/api-route'
import {
  getMissingAdminBookRequiredFieldsMessage,
  getNullableAdminBookIsbn,
  type AdminBookCreateInput,
  type AdminBookUpdateInput,
} from '@/services/book-input.service'
import { addSchoolBookCode, getSchoolBookCodes } from '@/services/book-code.service'
import type { DbClient } from '@/lib/db'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/shared/barcode'
import type { AdminBookRow, BookRow } from '@/types/library'
import * as bookRepository from '@/repositories/book.repository'

export const ADMIN_BOOK_COLUMNS =
  'id, isbn, school_book_code, school_book_codes, title, author, publisher, category, total_copies, available_copies, created_at'

export const ADMIN_BOOK_EXPORT_COLUMNS =
  'id, title, author, publisher, isbn, school_book_code, school_book_codes, category, total_copies, available_copies'

export const ADMIN_BOOK_EXPORT_FIELD_ORDER = [
  'id',
  'title',
  'author',
  'publisher',
  'isbn',
  'school_book_code',
  'school_book_codes',
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
  school_book_codes: '학교 도서 코드 목록',
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
  school_book_codes: 'school_book_codes',
  title: 'title',
  total_copies: 'total_copies',
  available_copies: 'available_copies',
  author: 'author',
  category: 'category',
  도서명: 'title',
  분류: 'category',
  저자: 'author',
  출판사: 'publisher',
  'ISBN 코드': 'isbn',
  'ISBN코드': 'isbn',
  'ISBN Code': 'isbn',
  'ISBNCode': 'isbn',
  'ISBN번호': 'isbn',
  '국제표준도서번호': 'isbn',
  '총 권수': 'total_copies',
  '학교 도서 코드': 'school_book_code',
  '학교 도서 코드 목록': 'school_book_codes',
  '학교 도서 코드들': 'school_book_codes',
  '학교도서코드': 'school_book_code',
  '학교도서코드목록': 'school_book_codes',
  '학교도서코드들': 'school_book_codes',
  '학교 내 도서 코드': 'school_book_code',
  '학교내도서코드': 'school_book_code',
  '대출 가능 권수': 'available_copies',
}

export const ADMIN_BOOK_IMPORT_BATCH_SIZE = 200

const DEFAULT_BOOK_CATEGORY = '미분류'

function duplicateBookCodeError() {
  return new ApiRouteError(409, 'DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 도서 코드입니다.')
}

function getDbErrorCode(error: unknown, depth = 0): string {
  if (depth > 3 || typeof error !== 'object' || error === null) {
    return ''
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code
  }

  return 'cause' in error ? getDbErrorCode(error.cause, depth + 1) : ''
}

type DbErrorDetails = {
  code: string
  column: string
  detail: string
  message: string
  table: string
}

function getDbErrorDetails(error: unknown, depth = 0): DbErrorDetails {
  const emptyDetails: DbErrorDetails = {
    code: '',
    column: '',
    detail: '',
    message: '',
    table: '',
  }

  if (depth > 5 || typeof error !== 'object' || error === null) {
    return emptyDetails
  }

  const errorRecord = error as Record<string, unknown>
  const getString = (key: keyof DbErrorDetails) =>
    typeof errorRecord[key] === 'string' ? String(errorRecord[key]) : ''
  const currentDetails: DbErrorDetails = {
    code: getString('code'),
    column: getString('column'),
    detail: getString('detail'),
    message: error instanceof Error ? error.message : getString('message'),
    table: getString('table'),
  }
  const causeDetails =
    'cause' in error ? getDbErrorDetails(error.cause, depth + 1) : emptyDetails

  // The PostgreSQL error is normally the deepest error carrying a SQLSTATE code.
  return causeDetails.code ? causeDetails : currentDetails
}

function getDbErrorSummary(details: DbErrorDetails) {
  const location = [details.table, details.column].filter(Boolean).join('.')
  const message = (details.message || details.detail || '알 수 없는 DB 오류')
    .replace(/\s+/g, ' ')
    .slice(0, 240)

  return [details.code && `코드 ${details.code}`, location && `대상 ${location}`, message]
    .filter(Boolean)
    .join(' / ')
}

function getAdminBookDatabaseError(error: unknown) {
  const details = getDbErrorDetails(error)
  const { code } = details

  if (code === '42501') {
    return new ApiRouteError(
      503,
      'ADMIN_BOOK_DATABASE_ACCESS_DENIED',
      '서버 DB 계정에 도서 관리 권한이 없습니다. books 테이블의 RLS 정책을 확인해주세요.'
    )
  }

  if (code === '42P01' || code === '42703') {
    return new ApiRouteError(
      503,
      'ADMIN_BOOK_DATABASE_SCHEMA_OUTDATED',
      `도서 DB 쿼리 오류: ${getDbErrorSummary(details)}`
    )
  }

  return error
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
  author?: string | null
  available_copies?: number
  category?: string
  isbn?: string | null
  publisher?: string | null
  school_book_code?: string | null
  school_book_codes?: string[] | null
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
      author: input.author.trim() || null,
      available_copies: 1,
      category: DEFAULT_BOOK_CATEGORY,
      isbn: normalizeIsbnInput(input.isbn) || null,
      publisher: input.publisher.trim() || null,
      school_book_code: normalizeBarcodeInput(input.schoolBookCode),
      school_book_codes: [normalizeBarcodeInput(input.schoolBookCode)],
      title: input.title,
      total_copies: 1,
    })

    invalidateAdminBooksCache()
    return book
  } catch (error) {
    if (getDbErrorCode(error) === '23505') {
      throw duplicateBookCodeError()
    }
    throw getAdminBookDatabaseError(error)
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

function createImportedBookValues(
  book: ImportAdminBookInput
): bookRepository.AdminBookInsertValues {
  const schoolBookCodes = getImportedSchoolBookCodes(book)
  const schoolBookCode = schoolBookCodes[0] ?? null
  const totalCopies = book.total_copies ?? 1
  const availableCopies = book.available_copies ?? totalCopies

  return {
    author: book.author?.trim() || null,
    available_copies: availableCopies,
    category: book.category || DEFAULT_BOOK_CATEGORY,
    isbn: normalizeImportedIsbn(book.isbn),
    publisher: book.publisher?.trim() || null,
    school_book_code: schoolBookCode,
    school_book_codes: schoolBookCodes,
    title: book.title,
    total_copies: totalCopies,
  }
}

function normalizeImportedIsbn(value: string | null | undefined) {
  return normalizeIsbnInput(value ?? '') || null
}

function getImportedSchoolBookCodes(book: ImportAdminBookInput) {
  return Array.from(
    new Set(
      [book.school_book_code ?? '', ...(book.school_book_codes ?? [])]
        .map((code) => normalizeBarcodeInput(code))
        .filter(Boolean)
    )
  )
}

type ExistingImportTarget = {
  book: AdminBookRow
  kind: 'existing'
}

type NewImportTarget = {
  book: bookRepository.AdminBookInsertValues
  kind: 'new'
}

type ImportTarget = ExistingImportTarget | NewImportTarget

function addImportedCopies(target: ImportTarget, book: ImportAdminBookInput) {
  const schoolBookCodes = getImportedSchoolBookCodes(book)
  const totalCopies = book.total_copies ?? 1
  const availableCopies = book.available_copies ?? totalCopies

  target.book.available_copies += availableCopies
  target.book.total_copies += totalCopies

  if (schoolBookCodes.length > 0) {
    target.book.school_book_code ||= schoolBookCodes[0]
    for (const schoolBookCode of schoolBookCodes) {
      target.book.school_book_codes = addSchoolBookCode(target.book, schoolBookCode)
    }
  }
}

function getImportLookupValues(rows: ImportAdminBookRow[]) {
  const isbns = new Set<string>()
  const schoolBookCodes = new Set<string>()

  for (const row of rows) {
    const isbn = normalizeImportedIsbn(row.book.isbn)
    if (isbn) {
      isbns.add(isbn)
    }

    for (const schoolBookCode of getImportedSchoolBookCodes(row.book)) {
      if (schoolBookCode) {
        schoolBookCodes.add(schoolBookCode)
      }
    }
  }

  return {
    isbns: Array.from(isbns),
    schoolBookCodes: Array.from(schoolBookCodes),
  }
}

async function insertAdminBookImportBatch(
  db: DbClient,
  rows: ImportAdminBookRow[],
  batchNumber: number
): Promise<ImportAdminBooksResult> {
  let phase = 'transaction'

  try {
    return await db.transaction(async (transaction) => {
      phase = 'lookup'
      console.log('[BOOK_IMPORT] batch lookup started', { batch: batchNumber })
      const existingBooks = await bookRepository.findBooksForImport(
        transaction,
        getImportLookupValues(rows)
      )
      console.log('[BOOK_IMPORT] batch lookup completed', {
        batch: batchNumber,
        existing_books: existingBooks.length,
      })

      phase = 'planning'
      const usedSchoolBookCodes = new Set<string>()
      const targetsByIsbn = new Map<string, ImportTarget>()
      const existingUpdates = new Map<string, ExistingImportTarget>()
      const newTargets: NewImportTarget[] = []
      let inserted = 0
      let skipped = 0

      for (const existingBook of existingBooks) {
        const target: ExistingImportTarget = {
          book: {
            ...existingBook,
            school_book_codes: [...existingBook.school_book_codes],
          },
          kind: 'existing',
        }

        for (const schoolBookCode of getSchoolBookCodes(existingBook)) {
          usedSchoolBookCodes.add(schoolBookCode)
        }

        const isbn = normalizeImportedIsbn(existingBook.isbn)
        if (isbn) {
          targetsByIsbn.set(isbn, target)
        }
      }

      // Preserve the previous row-by-row duplicate semantics while planning one bulk write.
      for (const row of rows) {
        const schoolBookCodes = getImportedSchoolBookCodes(row.book)

        if (schoolBookCodes.some((schoolBookCode) => usedSchoolBookCodes.has(schoolBookCode))) {
          skipped += 1
          continue
        }

        const isbn = normalizeImportedIsbn(row.book.isbn)
        const isbnTarget = isbn ? targetsByIsbn.get(isbn) : undefined

        if (isbnTarget) {
          addImportedCopies(isbnTarget, row.book)
          if (isbnTarget.kind === 'existing') {
            existingUpdates.set(isbnTarget.book.id, isbnTarget)
          }
        } else {
          const newTarget: NewImportTarget = {
            book: createImportedBookValues(row.book),
            kind: 'new',
          }
          newTargets.push(newTarget)

          if (newTarget.book.isbn) {
            targetsByIsbn.set(newTarget.book.isbn, newTarget)
          }
        }

        for (const schoolBookCode of schoolBookCodes) {
          usedSchoolBookCodes.add(schoolBookCode)
        }
        inserted += 1
      }

      console.log('[BOOK_IMPORT] batch planning completed', {
        batch: batchNumber,
        inserts: newTargets.length,
        skipped,
        updates: existingUpdates.size,
      })

      phase = 'bulk insert'
      console.log('[BOOK_IMPORT] batch insert started', {
        batch: batchNumber,
        rows: newTargets.length,
      })
      await bookRepository.insertAdminBooks(
        transaction,
        newTargets.map((target) => target.book)
      )
      console.log('[BOOK_IMPORT] batch insert completed', { batch: batchNumber })

      phase = 'bulk update'
      console.log('[BOOK_IMPORT] batch update started', {
        batch: batchNumber,
        rows: existingUpdates.size,
      })
      await bookRepository.updateBookCopiesAndCodesInBulk(
        transaction,
        Array.from(existingUpdates.values(), (target) => ({
          available_copies: target.book.available_copies,
          id: target.book.id,
          school_book_code: target.book.school_book_code,
          school_book_codes: target.book.school_book_codes,
          total_copies: target.book.total_copies,
        }))
      )
      console.log('[BOOK_IMPORT] batch update completed', { batch: batchNumber })

      return { errors: [], inserted, skipped }
    })
  } catch (error) {
    console.error('[BOOK_IMPORT] batch failed', {
      batch: batchNumber,
      phase,
      ...getDbErrorDetails(error),
    })
    if (getDbErrorCode(error) === '23505') {
      throw duplicateBookCodeError()
    }
    throw getAdminBookDatabaseError(error)
  }
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
    const batchNumber = Math.floor(index / ADMIN_BOOK_IMPORT_BATCH_SIZE) + 1
    const batchStartedAt = Date.now()
    console.log('[BOOK_IMPORT] batch started', {
      batch: batchNumber,
      rows: batch.length,
    })
    const result = await insertAdminBookImportBatch(db, batch, batchNumber)
    console.log('[BOOK_IMPORT] batch completed', {
      batch: batchNumber,
      duration_ms: Date.now() - batchStartedAt,
      inserted: result.inserted,
      skipped: result.skipped,
    })
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
    throw getAdminBookDatabaseError(error)
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
        throw getAdminBookDatabaseError(error)
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
    const existingBook = await bookRepository.findAdminBookById(db, bookId)
    if (!existingBook) {
      throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '수정할 도서를 찾을 수 없습니다.')
    }

    const schoolBookCode = normalizeBarcodeInput(input.schoolBookCode)
    const bookWithSchoolBookCode = await bookRepository.findBookBySchoolBookCode(db, schoolBookCode)
    if (bookWithSchoolBookCode && bookWithSchoolBookCode.id !== bookId) {
      throw duplicateBookCodeError()
    }

    const updatedBook = await bookRepository.updateAdminBook(db, bookId, {
      author: input.author.trim() || null,
      isbn: getNullableAdminBookIsbn(input),
      publisher: input.publisher.trim() || null,
      school_book_code: schoolBookCode,
      school_book_codes: addSchoolBookCode(existingBook, schoolBookCode),
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
    throw getAdminBookDatabaseError(error)
  }
}
