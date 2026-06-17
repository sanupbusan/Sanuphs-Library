import { ApiRouteError } from '@/lib/api-route'
import {
  getMissingAdminBookRequiredFieldsMessage,
  getNullableAdminBookIsbn,
  getNullableAdminBookLocation,
  type AdminBookCreateInput,
  type AdminBookUpdateInput,
} from '@/lib/admin-book-input'
import { addSchoolBookCode } from '@/lib/school-book-codes'
import type { TypedSupabaseClient } from '@/lib/supabase'
import type { AdminBookRow } from '@/types/library'

export const ADMIN_BOOK_COLUMNS =
  'id, isbn, school_book_code, school_book_codes, title, author, publisher, category, total_copies, available_copies, location, created_at'

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

  const { data: bookWithSchoolBookCodeList, error: schoolBookCodesError } = await supabase
    .from('books')
    .select(ADMIN_BOOK_COLUMNS)
    .contains('school_book_codes', [input.schoolBookCode])
    .maybeSingle()

  if (schoolBookCodesError) {
    throw schoolBookCodesError
  }

  if (bookWithSchoolBookCodeList) {
    throw duplicateBookCodeError()
  }

  const { data: bookWithPrimarySchoolBookCode, error: primarySchoolBookCodeError } = await supabase
    .from('books')
    .select(ADMIN_BOOK_COLUMNS)
    .eq('school_book_code', input.schoolBookCode)
    .maybeSingle()

  if (primarySchoolBookCodeError) {
    throw primarySchoolBookCodeError
  }

  if (bookWithPrimarySchoolBookCode) {
    throw duplicateBookCodeError()
  }

  const isbn = getNullableAdminBookIsbn(input)

  if (isbn) {
    const { data: existingBook, error: existingBookError } = await supabase
      .from('books')
      .select(ADMIN_BOOK_COLUMNS)
      .eq('isbn', isbn)
      .maybeSingle()

    if (existingBookError) {
      throw existingBookError
    }

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
      location: getNullableAdminBookLocation(input),
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
