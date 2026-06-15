'use server'

import { revalidatePath } from 'next/cache'
import { AdminAuthError } from '@/lib/admin-auth'
import { deleteAdminBook } from '@/lib/admin-books'
import { ApiRouteError } from '@/lib/api-route'
import { requireAdminSessionFromCookies } from '@/lib/admin-server-auth'
import type { ApiError } from '@/types/library'

type DeleteBookActionResult = {
  data?: {
    id: string
    title: string | null
  }
  error?: ApiError
}

function getActionError(error: unknown): ApiError {
  if (error instanceof AdminAuthError || error instanceof ApiRouteError) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  console.error('Delete book action failed:', error)

  return {
    code: 'DELETE_BOOK_FAILED',
    message: '도서 제거에 실패했습니다.',
  }
}

export async function deleteBookAction(bookId: string): Promise<DeleteBookActionResult> {
  try {
    const session = await requireAdminSessionFromCookies()
    const data = await deleteAdminBook(session.supabase, bookId.trim())

    revalidatePath('/admin/books')
    revalidatePath('/admin/add_books')

    return { data }
  } catch (error) {
    return {
      error: getActionError(error),
    }
  }
}
