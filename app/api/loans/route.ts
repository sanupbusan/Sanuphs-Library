import { NextResponse } from 'next/server'
import { AdminAuthError, adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { createRouteSupabaseClient } from '@/lib/api-route'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { BorrowerType, CreatedPublicLoan, LoanCreationResult } from '@/types/library'

export const dynamic = 'force-dynamic'

type CreateLoanBody = {
  bookId?: unknown
  studentId?: unknown
  notes?: unknown
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return ''
}

function jsonLoanError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

function mapCreatedLoan(loan: CreatedPublicLoan): LoanCreationResult {
  return {
    activeLoanCount: loan.active_loan_count,
    bookTitle: loan.book_title,
    borrowerLabel: loan.borrower_label,
    borrowerType: loan.borrower_type as BorrowerType,
    dueOn: loan.due_on,
    loanId: loan.loan_id,
    loanLimit: loan.loan_limit,
    remainingLoanCount: loan.remaining_loan_count,
    studentName: loan.student_name,
  }
}

function loanRpcErrorResponse(error: unknown) {
  const message = getErrorMessage(error)
  const [code, detail] = message.split('|')

  switch (code) {
    case 'BOOK_NOT_FOUND':
      return jsonLoanError(404, 'BOOK_NOT_FOUND', '해당 도서를 찾을 수 없습니다.')
    case 'STUDENT_NOT_FOUND':
      return jsonLoanError(404, 'STUDENT_NOT_FOUND', '해당 학생을 찾을 수 없습니다.')
    case 'NO_AVAILABLE_COPIES':
      return jsonLoanError(409, 'NO_AVAILABLE_COPIES', '대여 가능한 도서가 없습니다.')
    case 'ALREADY_RENTED':
      return jsonLoanError(409, 'ALREADY_RENTED', '이미 대여 중인 도서입니다.')
    case 'STUDENT_LOAN_BANNED':
      return jsonLoanError(
        409,
        'STUDENT_LOAN_BANNED',
        detail ? `대여 정지 기간입니다. ${detail}까지 대여할 수 없습니다.` : '대여 정지 기간입니다.'
      )
    case 'STUDENT_HAS_OVERDUE_LOAN':
      return jsonLoanError(
        409,
        'STUDENT_HAS_OVERDUE_LOAN',
        detail ? `연체 중인 도서가 있어 대여할 수 없습니다. 가장 오래된 반납 예정일: ${detail}` : '연체 중인 도서가 있어 대여할 수 없습니다.'
      )
    default:
      return null
  }
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

  if (!isUuid(bookId) || !isUuid(studentId)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ID',
          message: '도서 ID와 학생 ID 형식이 올바르지 않습니다.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createRouteSupabaseClient()
    const { data, error } = await supabase.rpc('create_public_loan', {
      input_book_id: bookId,
      input_student_id: studentId,
      input_notes: getText(body.notes) || null,
    })

    if (error) {
      const mappedResponse = loanRpcErrorResponse(error)

      if (mappedResponse) {
        return mappedResponse
      }

      throw error
    }

    const loan = data?.[0]

    if (!loan) {
      throw new Error('Loan RPC returned no result.')
    }

    return NextResponse.json({ data: mapCreatedLoan(loan) }, { status: 201 })
  } catch (error) {
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
