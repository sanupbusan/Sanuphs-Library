'use server'

import { revalidatePath } from 'next/cache'
import { AdminAuthError } from '@/lib/admin-auth'
import { deleteAdminBook, updateAdminBook } from '@/lib/admin-books'
import { ApiRouteError, getText } from '@/lib/api-route'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import { requireAdminSessionFromCookies } from '@/lib/admin-server-auth'
import type { AdminBookUpdateInput } from '@/lib/admin-book-input'
import type { AdminBookRow, ApiError } from '@/types/library'

type DeleteBookActionResult = {
  data?: {
    id: string
    title: string | null
  }
  error?: ApiError
}

type UpdateBookActionResult = {
  data?: AdminBookRow
  error?: ApiError
}

type AdminBookUpdateActionInput = Partial<Record<keyof AdminBookUpdateInput, unknown>>

function getUpdateInputObject(input: unknown): AdminBookUpdateActionInput {
  return input && typeof input === 'object' ? input as AdminBookUpdateActionInput : {}
}

function trimUpdateInput(input: AdminBookUpdateActionInput): AdminBookUpdateInput {
  return {
    author: getText(input.author),
    isbn: normalizeIsbnInput(getText(input.isbn)),
    publisher: getText(input.publisher),
    schoolBookCode: normalizeBarcodeInput(getText(input.schoolBookCode)),
    title: getText(input.title),
  }
}

function getActionError(error: unknown, fallback: ApiError, logLabel: string): ApiError {
  if (error instanceof AdminAuthError || error instanceof ApiRouteError) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  console.error(logLabel, error)

  return fallback
}

export async function deleteBookAction(bookId: unknown): Promise<DeleteBookActionResult> {
  try {
    const session = await requireAdminSessionFromCookies()
    const data = await deleteAdminBook(session.supabase, getText(bookId))

    revalidatePath('/admin/books')
    revalidatePath('/admin/add_books')

    return { data }
  } catch (error) {
    return {
      error: getActionError(
        error,
        {
          code: 'DELETE_BOOK_FAILED',
          message: '도서 제거에 실패했습니다.',
        },
        'Delete book action failed:'
      ),
    }
  }
}

export async function updateBookAction(
  bookId: unknown,
  input: unknown
): Promise<UpdateBookActionResult> {
  try {
    const session = await requireAdminSessionFromCookies()
    const data = await updateAdminBook(session.supabase, getText(bookId), trimUpdateInput(getUpdateInputObject(input)))

    revalidatePath('/admin/books')
    revalidatePath('/admin/add_books')

    return { data }
  } catch (error) {
    return {
      error: getActionError(
        error,
        {
          code: 'UPDATE_BOOK_FAILED',
          message: '도서 정보 수정에 실패했습니다.',
        },
        'Update book action failed:'
      ),
    }
  }
}
