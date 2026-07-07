import { readApiData } from '@/lib/api-client'
import type { IsbnLookupResult } from '@/types/library'

export async function lookupAdminBookByIsbn(isbn: string) {
  const params = new URLSearchParams({ isbn })
  const response = await fetch(`/api/admin/books/isbn?${params.toString()}`, {
    cache: 'no-store',
  })

  return readApiData<IsbnLookupResult>(response, 'ISBN 정보 조회에 실패했습니다.')
}
