import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type ReturnedLoan = Database['public']['Functions']['return_loans_by_school_book_codes']['Returns'][number]

type ReturnBooksBody = {
  schoolBookCodes?: unknown
}

function getSchoolBookCodes(body: ReturnBooksBody) {
  if (!Array.isArray(body.schoolBookCodes)) {
    return []
  }

  return body.schoolBookCodes
    .map((code) => (typeof code === 'string' ? normalizeBarcodeInput(code) : ''))
    .filter(Boolean)
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

  const schoolBookCodes = getSchoolBookCodes(body)

  if (schoolBookCodes.length === 0) {
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
    const { data, error } = await supabase.rpc('return_loans_by_school_book_codes', {
      input_school_book_codes: schoolBookCodes,
    })

    if (error) {
      throw error
    }

    const returnedLoans = (data ?? []) as ReturnedLoan[]

    if (returnedLoans.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'LOAN_NOT_FOUND',
            message: '대여 중인 도서를 찾지 못해 반납 처리하지 못했습니다.',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        data: returnedLoans,
        meta: {
          count: returnedLoans.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('Book returns failed:', error)

    return NextResponse.json(
      {
        error: {
          code: 'BOOK_RETURN_FAILED',
          message: error instanceof Error ? error.message : '도서 반납 처리에 실패했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
