import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBarcodeInput } from '@/lib/barcode-input'

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
      { status: 400 }
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const normalizedCode = normalizeCode(code)
    const isIsbn = isLikelyIsbn(normalizedCode)

    let query = supabase
      .from('books')
      .select('id, isbn, school_book_code, school_book_codes, title, author, publisher, available_copies, total_copies')

    if (isIsbn) {
      query = query.eq('isbn', normalizedCode)
    } else {
      query = query.contains('school_book_codes', [normalizedCode])
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json(
        {
          error: {
            code: 'BOOK_NOT_FOUND',
            message: '해당 도서 코드의 책을 찾을 수 없습니다.',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Book lookup error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: '도서 정보를 조회하는 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
