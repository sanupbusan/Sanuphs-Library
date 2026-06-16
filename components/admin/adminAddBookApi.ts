import { readApiData } from '@/lib/api-client'
import type { AdminBookRow, IsbnLookupResult } from '@/types/library'
import type { AdminBookFormInput } from '@/components/admin/useAdminAddBookDraft'

export async function createAdminBook(input: AdminBookFormInput) {
  const response = await fetch('/api/admin/books', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  return readApiData<AdminBookRow>(response, '책 등록에 실패했습니다.')
}

export async function lookupAdminBookByIsbn(isbn: string) {
  const params = new URLSearchParams({ isbn })
  const response = await fetch(`/api/admin/books/isbn?${params.toString()}`, {
    cache: 'no-store',
  })

  return readApiData<IsbnLookupResult>(response, 'ISBN 정보 조회에 실패했습니다.')
}
