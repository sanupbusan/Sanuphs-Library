import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type ReturnableLoan = Database['public']['Functions']['get_returnable_loan_by_school_book_code']['Returns'][number]
type ReturnedLoan = Database['public']['Functions']['return_loans_by_school_book_codes']['Returns'][number]

type ReturnLoansBody = {
  code?: unknown
  schoolBookCodes?: unknown
}

function getCode(request: Request) {
  const url = new URL(request.url)

  return normalizeBarcodeInput(url.searchParams.get('code') ?? '')
}

function getText(value: unknown) {
  return typeof value === 'string' ? normalizeBarcodeInput(value) : ''
}

function getSchoolBookCodesFromBody(body: ReturnLoansBody) {
  if (Array.isArray(body.schoolBookCodes)) {
    return body.schoolBookCodes
      .map((code) => getText(code))
      .filter(Boolean)
  }

  const code = getText(body.code)

  return code ? [code] : []
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

    const { data: returnableLoans, error: returnableLoanError } = await supabase.rpc(
      'get_returnable_loan_by_school_book_code',
      {
        input_school_book_code: code,
      }
    )

    if (returnableLoanError) {
      throw returnableLoanError
    }

    const loan = (returnableLoans ?? [])[0] as ReturnableLoan | undefined

    if (!loan) {
      return NextResponse.json(
        {
          error: {
            code: 'LOAN_NOT_FOUND',
            message: '해당 도서는 대여 중이 아닙니다.',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { data: loan },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('Book return lookup failed:', error)

    return NextResponse.json(
      {
        error: {
          code: 'BOOK_RETURN_LOOKUP_FAILED',
          message: error instanceof Error ? error.message : '반납할 대여 정보를 조회하는 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    )
  }
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

  let body: ReturnLoansBody

  try {
    body = (await request.json()) as ReturnLoansBody
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

  const schoolBookCodes = getSchoolBookCodesFromBody(body)

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

    const { data: returnedLoans, error: returnLoanError } = await supabase.rpc('return_loans_by_school_book_codes', {
      input_school_book_codes: schoolBookCodes,
    })

    if (returnLoanError) {
      throw returnLoanError
    }

    const returnedLoanList = (returnedLoans ?? []) as ReturnedLoan[]

    if (returnedLoanList.length === 0) {
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
        data: returnedLoanList,
        meta: {
          count: returnedLoanList.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('Book return failed:', error)

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
