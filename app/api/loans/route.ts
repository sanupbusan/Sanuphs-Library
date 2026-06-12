import { NextResponse } from 'next/server'
import { AdminAuthError, adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type CreatedPublicLoan = Database['public']['Functions']['create_public_loan']['Returns'][number]

type CreateLoanBody = {
  bookId?: unknown
  studentId?: unknown
  notes?: unknown
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isLoanLimitError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23514' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('최대')
  )
}

function getLoanCreationErrorResponse(error: unknown) {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : ''

  if (message.includes('BOOK_NOT_FOUND')) {
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

  if (message.includes('STUDENT_NOT_FOUND')) {
    return NextResponse.json(
      {
        error: {
          code: 'STUDENT_NOT_FOUND',
          message: '해당 학생을 찾을 수 없습니다.',
        },
      },
      { status: 404 }
    )
  }

  if (message.includes('NO_AVAILABLE_COPIES')) {
    return NextResponse.json(
      {
        error: {
          code: 'NO_AVAILABLE_COPIES',
          message: '이미 대여 중인 도서입니다.',
        },
      },
      { status: 409 }
    )
  }

  if (message.includes('ALREADY_RENTED')) {
    return NextResponse.json(
      {
        error: {
          code: 'ALREADY_RENTED',
          message: '이미 대여 중인 도서입니다.',
        },
      },
      { status: 409 }
    )
  }

  if (isLoanLimitError(error)) {
    return NextResponse.json(
      {
        error: {
          code: 'LOAN_LIMIT_EXCEEDED',
          message: error instanceof Error ? error.message : '대여 가능 권수를 초과했습니다.',
        },
      },
      { status: 409 }
    )
  }

  return null
}

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const supabase = session.supabase
    const { data, error } = await supabase
      .from('loans')
      .select('id, book_id, student_id, borrowed_on, due_on, returned_on, status, books(title, school_book_code), students(name, student_number)')
      .eq('status', 'rented')
      .order('borrowed_on', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(
      { data: data ?? [] },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminAuthErrorResponse(error)
    }

    console.error('Loan fetch error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: '대여 목록을 불러오는 중 오류가 발생했습니다.',
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

  let body: CreateLoanBody

  try {
    body = (await request.json()) as CreateLoanBody
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

  const bookId = getText(body.bookId)
  const studentId = getText(body.studentId)

  if (!bookId || !studentId) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_FIELDS',
          message: '학생 ID와 도서 ID를 모두 입력해주세요.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('create_public_loan', {
      input_book_id: bookId,
      input_notes: getText(body.notes) || null,
      input_student_id: studentId,
    })

    if (error) {
      const errorResponse = getLoanCreationErrorResponse(error)

      if (errorResponse) {
        return errorResponse
      }

      throw error
    }

    const loan = (data ?? [])[0] as CreatedPublicLoan | undefined

    if (!loan) {
      return NextResponse.json(
        {
          error: {
            code: 'CREATE_LOAN_FAILED',
            message: '대여 처리 결과를 확인하지 못했습니다. 다시 시도해주세요.',
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        data: {
          bookTitle: loan.book_title,
          activeLoanCount: loan.active_loan_count,
          borrowerLabel: loan.borrower_label,
          borrowerType: loan.borrower_type,
          dueOn: loan.due_on,
          loanLimit: loan.loan_limit,
          loanId: loan.loan_id,
          remainingLoanCount: loan.remaining_loan_count,
          studentName: loan.student_name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const errorResponse = getLoanCreationErrorResponse(error)

    if (errorResponse) {
      return errorResponse
    }

    console.error('Loan creation error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'CREATE_LOAN_FAILED',
          message: error instanceof Error ? error.message : '대여 처리 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
