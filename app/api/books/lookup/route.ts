import { normalizeBarcodeInput } from '@/lib/barcode-input'
import {
  createRouteSupabaseClient,
  jsonData,
  runApiRoute,
  throwApiError,
} from '@/lib/api-route'

export const dynamic = 'force-dynamic'

function getCode(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('code')?.trim() ?? ''
}

function normalizeCode(value: string) {
  return normalizeBarcodeInput(value).toUpperCase()
}

function isLikelyIsbn(value: string) {
  const digits = value.replace(/[^0-9Xx]/g, '')

  return digits.length === 10 || digits.length === 13
}

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'FETCH_FAILED',
        message: '도서 정보를 조회하는 중 오류가 발생했습니다.',
      },
      logLabel: 'Book lookup error:',
    },
    async () => {
      const code = getCode(request)

      if (!code) {
        throwApiError(400, 'MISSING_CODE', '도서 코드를 입력해주세요.')
      }

      const supabase = createRouteSupabaseClient()
      const normalizedCode = normalizeCode(code)
      const isIsbn = isLikelyIsbn(normalizedCode)

      let query = supabase
        .from('books')
        .select('id, isbn, school_book_code, title, author, publisher, available_copies, total_copies')

      if (isIsbn) {
        query = query.eq('isbn', normalizedCode)
      } else {
        query = query.eq('school_book_code', normalizedCode)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        throwApiError(404, 'BOOK_NOT_FOUND', '해당 도서 코드의 책을 찾을 수 없습니다.')
      }

      return jsonData(data)
    }
  )
}
