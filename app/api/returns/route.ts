import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ReturnBooksBody = {
  schoolBookCodes?: unknown
}

function normalizeSchoolBookCodes(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((code): code is string => typeof code === 'string')
        .map((code) => code.trim())
        .filter(Boolean)
    )
  )
}

export async function POST(request: Request) {
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

  let body: ReturnBooksBody
  try {
    body = (await request.json()) as ReturnBooksBody
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_JSON',
          message: '요청 본문이 올바른 JSON이어야 합니다.',
        },
      },
      { status: 400 }
    )
  }

  const schoolBookCodes = normalizeSchoolBookCodes(body.schoolBookCodes)

  if (schoolBookCodes.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_SCHOOL_BOOK_CODES',
          message: '반납할 학교 도서 코드를 선택해주세요.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('return_loans_by_school_book_codes', {
      input_school_book_codes: schoolBookCodes,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({
      data: data ?? [],
      meta: {
        count: data?.length ?? 0,
      },
    })
  } catch (error) {
    console.error('Book return failed:', error)

    return NextResponse.json(
      {
        error: {
          code: 'BOOK_RETURN_FAILED',
          message: '도서 반납 처리에 실패했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
