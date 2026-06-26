import { ApiRouteError } from '@/lib/api-route'
import {
  getMissingAdminBookRequiredFieldsMessage,
  getNullableAdminBookIsbn,
  type AdminBookCreateInput,
  type AdminBookUpdateInput,
} from '@/lib/admin-book-input'
import { addSchoolBookCode } from '@/lib/school-book-codes'
import type { TypedSupabaseClient } from '@/lib/supabase'
import type { AdminBookRow, BookRow } from '@/types/library'
import type { Database } from '@/types/supabase'

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
  available_copies: '대여 가능 권수',
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
  '도서명': 'title',
  '분류': 'category',
  '저자': 'author',
  '출판사': 'publisher',
  '총 권수': 'total_copies',
  '학교 도서 코드': 'school_book_code',
  '대여 가능 권수': 'available_copies',
}

export const ADMIN_BOOK_IMPORT_BATCH_SIZE = 200

function duplicateBookCodeError() {
  return new ApiRouteError(409, 'DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 내 도서 코드입니다.')
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

async function fetchAdminBooks(supabase: TypedSupabaseClient): Promise<AdminBookRow[]> {
  const { data, error } = await supabase
    .from('books')
    .select(ADMIN_BOOK_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw error
  }

  return (data ?? []) as AdminBookRow[]
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

export type ImportAdminBookInput = Pick<
  Database['public']['Tables']['books']['Insert'],
  | 'author'
  | 'available_copies'
  | 'category'
  | 'isbn'
  | 'publisher'
  | 'school_book_code'
  | 'title'
  | 'total_copies'
>

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

export async function insertAdminBook(
  supabase: TypedSupabaseClient,
  input: CreateAdminBookInput
): Promise<AdminBookRow> {
  const { data, error } = await supabase
    .from('books')
    .insert({
      author: input.author,
      available_copies: 1,
      category: '미분류',
      isbn: input.isbn,
      publisher: input.publisher,
      school_book_code: input.schoolBookCode,
      school_book_codes: [input.schoolBookCode],
      title: input.title,
      total_copies: 1,
    })
    .select(ADMIN_BOOK_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ApiRouteError(409, 'DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 도서 코드입니다.')
    }

    throw error
  }

  invalidateAdminBooksCache()

  return data as AdminBookRow
}

export async function listAdminBooks(supabase: TypedSupabaseClient): Promise<AdminBookRow[]> {
  const now = Date.now()

  if (adminBookListCache && adminBookListCache.expiresAt > now) {
    return cloneAdminBooks(adminBookListCache.books)
  }

  if (!adminBookListCachePromise) {
    adminBookListCachePromise = fetchAdminBooks(supabase)
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

export async function listAdminBooksForExport(supabase: TypedSupabaseClient): Promise<BookRow[]> {
  const { data, error } = await supabase
    .from('books')
    .select(ADMIN_BOOK_EXPORT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as BookRow[]
}

async function findAdminBookBySchoolBookCode(supabase: TypedSupabaseClient, schoolBookCode: string) {
  const { data: bookWithSchoolBookCodeList, error: schoolBookCodesError } = await supabase
    .from('books')
    .select(ADMIN_BOOK_COLUMNS)
    .contains('school_book_codes', [schoolBookCode])
    .maybeSingle()

  if (schoolBookCodesError) {
    throw schoolBookCodesError
  }

  if (bookWithSchoolBookCodeList) {
    return bookWithSchoolBookCodeList as AdminBookRow
  }

  const { data: bookWithPrimarySchoolBookCode, error: primarySchoolBookCodeError } = await supabase
    .from('books')
    .select(ADMIN_BOOK_COLUMNS)
    .eq('school_book_code', schoolBookCode)
    .maybeSingle()

  if (primarySchoolBookCodeError) {
    throw primarySchoolBookCodeError
  }

  return (bookWithPrimarySchoolBookCode as AdminBookRow | null) ?? null
}

async function findAdminBookByIsbn(supabase: TypedSupabaseClient, isbn: string) {
  const { data, error } = await supabase
    .from('books')
    .select(ADMIN_BOOK_COLUMNS)
    .eq('isbn', isbn)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as AdminBookRow | null) ?? null
}

async function addImportedCopiesToExistingBook(
  supabase: TypedSupabaseClient,
  existingBook: AdminBookRow,
  book: ImportAdminBookInput
) {
  const schoolBookCode = book.school_book_code?.trim() || null
  const totalCopies = book.total_copies ?? 1
  const availableCopies = book.available_copies ?? totalCopies

  const { error } = await supabase
    .from('books')
    .update({
      available_copies: existingBook.available_copies + availableCopies,
      school_book_code: existingBook.school_book_code || schoolBookCode,
      school_book_codes: schoolBookCode
        ? addSchoolBookCode(existingBook, schoolBookCode)
        : existingBook.school_book_codes,
      total_copies: existingBook.total_copies + totalCopies,
    })
    .eq('id', existingBook.id)

  if (error) {
    if (error.code === '23505') {
      throw duplicateBookCodeError()
    }

    throw error
  }
}

async function insertImportedBook(supabase: TypedSupabaseClient, book: ImportAdminBookInput) {
  const schoolBookCode = book.school_book_code?.trim() || null
  const { error } = await supabase
    .from('books')
    .insert({
      ...book,
      school_book_codes: schoolBookCode ? [schoolBookCode] : [],
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw duplicateBookCodeError()
    }

    throw error
  }
}

async function importAdminBookRow(supabase: TypedSupabaseClient, row: ImportAdminBookRow) {
  const schoolBookCode = row.book.school_book_code?.trim() || null

  if (schoolBookCode) {
    const existingBookWithSchoolBookCode = await findAdminBookBySchoolBookCode(supabase, schoolBookCode)

    if (existingBookWithSchoolBookCode) {
      return 'skipped' as const
    }
  }

  if (row.book.isbn) {
    const existingBookWithIsbn = await findAdminBookByIsbn(supabase, row.book.isbn)

    if (existingBookWithIsbn) {
      await addImportedCopiesToExistingBook(supabase, existingBookWithIsbn, row.book)
      return 'inserted' as const
    }
  }

  await insertImportedBook(supabase, row.book)
  return 'inserted' as const
}

async function insertAdminBookImportBatch(
  supabase: TypedSupabaseClient,
  rows: ImportAdminBookRow[]
): Promise<ImportAdminBooksResult> {
  if (rows.length === 0) {
    return {
      errors: [],
      inserted: 0,
      skipped: 0,
    }
  }

  let inserted = 0
  let skipped = 0
  const errors: ImportAdminBookError[] = []

  for (const row of rows) {
    try {
      const result = await importAdminBookRow(supabase, row)

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

  return {
    errors,
    inserted,
    skipped,
  }
}

export async function insertAdminBooksInBatches(
  supabase: TypedSupabaseClient,
  rows: ImportAdminBookRow[]
): Promise<ImportAdminBooksResult> {
  let inserted = 0
  let skipped = 0
  const errors: ImportAdminBookError[] = []

  for (let index = 0; index < rows.length; index += ADMIN_BOOK_IMPORT_BATCH_SIZE) {
    const batch = rows.slice(index, index + ADMIN_BOOK_IMPORT_BATCH_SIZE)
    const result = await insertAdminBookImportBatch(supabase, batch)
    inserted += result.inserted
    skipped += result.skipped
    errors.push(...result.errors)
  }

  if (inserted > 0) {
    invalidateAdminBooksCache()
  }

  return {
    errors,
    inserted,
    skipped,
  }
}

export async function deleteAdminBook(supabase: TypedSupabaseClient, bookId: string) {
  if (!bookId) {
    throw new ApiRouteError(400, 'MISSING_BOOK_ID', '제거할 도서를 선택해주세요.')
  }

  const { data, error } = await supabase
    .from('books')
    .delete()
    .eq('id', bookId)
    .select('id, title')
    .maybeSingle()

  if (error) {
    if (error.code === '23503') {
      throw new ApiRouteError(409, 'BOOK_HAS_LOANS', '대여 기록이 있는 도서는 바로 제거할 수 없습니다.')
    }

    throw error
  }

  if (!data) {
    throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '제거할 도서를 찾을 수 없습니다.')
  }

  invalidateAdminBooksCache()

  return data
}

export async function createAdminBook(
  supabase: TypedSupabaseClient,
  input: AdminBookCreateInput
): Promise<AdminBookRow> {
  const missingFieldsMessage = getMissingAdminBookRequiredFieldsMessage(input)

  if (missingFieldsMessage) {
    throw new ApiRouteError(400, 'MISSING_REQUIRED_FIELDS', missingFieldsMessage)
  }

  const bookWithSchoolBookCode = await findAdminBookBySchoolBookCode(supabase, input.schoolBookCode)

  if (bookWithSchoolBookCode) {
    throw duplicateBookCodeError()
  }

  const isbn = getNullableAdminBookIsbn(input)

  if (isbn) {
    const existingBook = await findAdminBookByIsbn(supabase, isbn)

    if (existingBook) {
      const { data, error } = await supabase
        .from('books')
        .update({
          available_copies: existingBook.available_copies + 1,
          school_book_code: existingBook.school_book_code || input.schoolBookCode,
          school_book_codes: addSchoolBookCode(existingBook, input.schoolBookCode),
          total_copies: existingBook.total_copies + 1,
        })
        .eq('id', existingBook.id)
        .select(ADMIN_BOOK_COLUMNS)
        .single()

      if (error) {
        if (error.code === '23505') {
          throw duplicateBookCodeError()
        }

        throw error
      }

      invalidateAdminBooksCache()

      return data as AdminBookRow
    }
  }

  const { data, error } = await supabase
    .from('books')
    .insert({
      author: input.author,
      available_copies: 1,
      category: '미분류',
      isbn,
      publisher: input.publisher,
      school_book_code: input.schoolBookCode,
      school_book_codes: [input.schoolBookCode],
      title: input.title,
      total_copies: 1,
    })
    .select(ADMIN_BOOK_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw duplicateBookCodeError()
    }

    throw error
  }

  invalidateAdminBooksCache()

  return data as AdminBookRow
}

export async function updateAdminBook(
  supabase: TypedSupabaseClient,
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

  const { data, error } = await supabase
    .from('books')
    .update({
      author: input.author,
      isbn: getNullableAdminBookIsbn(input),
      publisher: input.publisher,
      school_book_code: input.schoolBookCode,
      school_book_codes: [input.schoolBookCode],
      title: input.title,
    })
    .eq('id', bookId)
    .select(ADMIN_BOOK_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      throw duplicateBookCodeError()
    }

    throw error
  }

  if (!data) {
    throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '수정할 도서를 찾을 수 없습니다.')
  }

  invalidateAdminBooksCache()

  return data as AdminBookRow
}
