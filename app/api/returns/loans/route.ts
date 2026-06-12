import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type ReturnableLoan = Database['public']['Functions']['get_returnable_loan_by_school_book_code']['Returns'][number]
type ReturnedLoan = Database['public']['Functions']['return_loans_by_school_book_codes']['Returns'][number]

function getCode(request: Request) {
  const url = new URL(request.url)

  return normalizeBarcodeInput(url.searchParams.get('code') ?? '')
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

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, school_book_code')
      .eq('school_book_code', code)
      .maybeSingle()

    if (bookError) {
      throw bookError
    }

    if (!book) {
      return NextResponse.json(
        {
          error: {
            code: 'BOOK_NOT_FOUND',
            message: '해당 도서를 찾을 수 없습니다.',
          },
        },
        { status: 404 }
      )
    }

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

    const { data: returnedLoans, error: returnLoanError } = await supabase.rpc('return_loans_by_school_book_codes', {
      input_school_book_codes: [code],
    })

    if (returnLoanError) {
      throw returnLoanError
    }

    const returnedLoan = (returnedLoans ?? [])[0] as ReturnedLoan | undefined

    if (!returnedLoan) {
      return NextResponse.json(
        {
          error: {
            code: 'RETURN_NOT_APPLIED',
            message: '반납 처리 결과를 확인하지 못했습니다. 다시 시도해주세요.',
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        data: {
          bookTitle: returnedLoan.book_title,
          returnedOn: returnedLoan.returned_on,
          studentName: returnedLoan.student_name,
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
