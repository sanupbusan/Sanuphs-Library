import { ApiRouteError } from '@/lib/api-route'
import {
  getMissingAdminBookRequiredFieldsMessage,
  getNullableAdminBookIsbn,
  getNullableAdminBookLocation,
  type AdminBookUpdateInput,
} from '@/lib/admin-book-input'
import type { TypedSupabaseClient } from '@/lib/supabase'
import type { AdminBookRow } from '@/types/library'

export const ADMIN_BOOK_COLUMNS =
  'id, isbn, school_book_code, title, author, publisher, category, total_copies, available_copies, location, created_at'

export async function listAdminBooks(supabase: TypedSupabaseClient): Promise<AdminBookRow[]> {
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

  return data
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
      title: input.title,
    })
    .eq('id', bookId)
    .select(ADMIN_BOOK_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      throw new ApiRouteError(409, 'DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 내 도서 코드입니다.')
    }

    throw error
  }

  if (!data) {
    throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '수정할 도서를 찾을 수 없습니다.')
  }

  return data as AdminBookRow
}
