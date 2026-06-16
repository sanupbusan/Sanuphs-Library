import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBarcodeInput } from '@/lib/barcode-input'

export const dynamic = 'force-dynamic'

function getCode(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('code')?.trim() ?? ''
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: 'SUPABASE_NOT_CONFIGURED',
          message: 'Supabase 환경변수가 설정되지 않았습니다.',
        },
      },
      { status: 503 }
    )
  }

  const code = getCode(request)

  if (!code) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_CODE',
          message: '도서 코드를 입력해주세요.',
        },
      },
      logLabel: 'Book lookup error:',
    },
    async () => {
      const code = getCode(request)

  try {
    const supabase = createServerSupabaseClient()
    const normalizedCode = normalizeCode(code)
    const isIsbn = isLikelyIsbn(normalizedCode)

      const supabase = createRouteSupabaseClient()
      const normalizedCode = normalizeBookLookupCode(code)
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

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Book lookup error:', error)

      return jsonData(data)
    }
  )
}
