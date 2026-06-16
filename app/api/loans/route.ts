import { NextResponse } from 'next/server'
import { AdminAuthError, adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { getBorrowerLoanLimit } from '@/lib/loan-limits'
import { createServiceRoleSupabaseClient, isSupabaseServiceRoleConfigured } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

type CreateLoanBody = {
  bookId?: unknown
  notes?: unknown
  studentId?: unknown
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

function supabaseServiceRoleNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: {
        code: 'SUPABASE_SERVICE_ROLE_NOT_CONFIGURED',
        message: 'Supabase service role 키가 설정되지 않았습니다.',
      },
    },
    { status: 503 }
  )
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

  if (message.includes('BOOK_NOT_FOUND')) {
    throw new ApiRouteError(404, 'BOOK_NOT_FOUND', '해당 도서를 찾을 수 없습니다.')
  }

  if (message.includes('STUDENT_NOT_FOUND')) {
    throw new ApiRouteError(404, 'STUDENT_NOT_FOUND', '해당 학생을 찾을 수 없습니다.')
  }

  if (message.includes('NO_AVAILABLE_COPIES') || message.includes('ALREADY_RENTED')) {
    throw new ApiRouteError(409, 'NO_AVAILABLE_COPIES', '이미 대여 중인 도서입니다.')
  }

export async function POST(request: Request) {
  if (!isSupabaseServiceRoleConfigured()) {
    return supabaseServiceRoleNotConfiguredResponse()
  }

  let body: CreateLoanBody

    throw new ApiRouteError(
      409,
      'STUDENT_LOAN_BANNED',
      `연체로 인한 대출 금지 기간입니다. ${formatKoreanDate(bannedUntil)}까지 대여할 수 없습니다.`
    )
  }

  if (message.startsWith('STUDENT_HAS_OVERDUE_LOAN|')) {
    const dueOn = message.split('|')[1] ?? ''

    throw new ApiRouteError(
      409,
      'STUDENT_HAS_OVERDUE_LOAN',
      `반납 예정일(${formatKoreanDate(
        dueOn
      )})이 지난 도서가 있어 대여할 수 없습니다. 먼저 연체 도서를 반납해주세요.`
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
    const supabase = createServiceRoleSupabaseClient()

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, available_copies')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
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

    if (book.available_copies <= 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_AVAILABLE_COPIES',
            message: '대여 가능한 도서가 없습니다.',
          },
        },
        { status: 409 }
      )
    }

export async function GET() {
  return runApiRoute(
    {
      fallback: {
        code: 'FETCH_FAILED',
        message: '대여 목록을 불러오는 중 오류가 발생했습니다.',
      },
      logLabel: 'Loan fetch error:',
    },
    async () => {
      const supabase = createRouteSupabaseClient()
      const { data, error } = await supabase
        .from('loans')
        .select('id, book_id, student_id, borrowed_on, due_on, returned_on, status, books(title, school_book_code), students(name, student_number)')
        .eq('status', 'rented')
        .order('borrowed_on', { ascending: false })

      if (error) {
        throw error
      }

      return jsonData(data ?? [], withNoStore())
    }
  )
}

export async function POST(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'CREATE_LOAN_FAILED',
        message: '대여 처리 중 오류가 발생했습니다.',
      },
      logLabel: 'Loan creation error:',
    },
    async () => {
      const body = await readJsonBody<CreateLoanBody>(request)
      const bookId = getText(body.bookId)
      const studentId = getText(body.studentId)

      if (!bookId || !studentId) {
        throwApiError(400, 'MISSING_FIELDS', '학생 ID와 도서 ID를 모두 입력해주세요.')
      }

      const supabase = createRouteSupabaseClient()
      const { data, error } = await supabase.rpc('create_public_loan', {
        input_book_id: bookId,
        input_notes: getText(body.notes) || null,
        input_student_id: studentId,
      })

      if (error) {
        throwKnownLoanCreationError(error)
        throw error
      }

      const loan = (data ?? [])[0] as CreatedPublicLoan | undefined

      if (!loan) {
        throwApiError(409, 'CREATE_LOAN_FAILED', '대여 처리 결과를 확인하지 못했습니다. 다시 시도해주세요.')
      }

      return jsonData(
        {
          activeLoanCount: loan.active_loan_count,
          bookTitle: loan.book_title,
          borrowerLabel: loan.borrower_label,
          borrowerType: loan.borrower_type,
          dueOn: loan.due_on,
          loanId: loan.loan_id,
          loanLimit: loan.loan_limit,
          remainingLoanCount: loan.remaining_loan_count,
          studentName: loan.student_name,
        },
      },
      { status: 201 }
    )
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
  )
}
