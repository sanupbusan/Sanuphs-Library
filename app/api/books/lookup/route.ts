import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getCode(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('code')?.trim() ?? ''
}

function normalizeCode(value: string) {
  return value.replace(/\s+/g, '').replace(/[^0-9A-Za-z-]/g, '')
}

function isLikelyIsbn(value: string) {
  const digits = value.replace(/[^0-9Xx]/g, '')

  return digits.length === 10 || digits.length === 13
}

export async function GET(request: Request) {
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
    const isIsbn = isLikelyIsbn(code)

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
  } catch {
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
