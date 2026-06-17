import { ApiRouteError } from '@/lib/api-route'
import type { TypedSupabaseClient } from '@/lib/supabase'
import type { AdminBookRow } from '@/types/library'

export const ADMIN_BOOK_COLUMNS =
  'id, isbn, school_book_code, title, author, publisher, category, total_copies, available_copies, location, created_at'

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
