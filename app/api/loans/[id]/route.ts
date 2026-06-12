import { NextResponse } from 'next/server'
import { AdminAuthError, adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

type PatchLoanBody = {
  borrowedOn?: unknown
  dueOn?: unknown
  status?: unknown
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const loanId = params.id

  if (!loanId) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_LOAN_ID',
          message: '대여 ID가 필요합니다.',
        },
      },
      { status: 400 }
    )
  }

  let body: PatchLoanBody

  try {
    body = (await request.json()) as PatchLoanBody
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

  try {
    const session = await requireAdminSession(request)
    const supabase = session.supabase
    const { data: existingLoan, error: existingLoanError } = await supabase
      .from('loans')
      .select('id, borrowed_on, due_on')
      .eq('id', loanId)
      .maybeSingle()

    if (existingLoanError) {
      throw existingLoanError
    }

    if (!existingLoan) {
      return NextResponse.json(
        {
          error: {
            code: 'LOAN_NOT_FOUND',
            message: '대여 정보를 찾을 수 없습니다.',
          },
        },
        { status: 404 }
      )
    }

    const updates: {
      borrowed_on?: string
      due_on?: string
      returned_on?: string | null
      status?: 'rented' | 'returned'
    } = {}

    const statusText = getText(body.status)
    const borrowedOnText = getText(body.borrowedOn)
    const dueOnText = getText(body.dueOn)

    if (statusText === 'returned') {
      updates.status = 'returned'
      updates.returned_on = new Date().toISOString().slice(0, 10)
    } else if (statusText === 'rented') {
      updates.status = 'rented'
      updates.returned_on = null
    } else if (statusText) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATUS',
            message: '대여 상태 값이 올바르지 않습니다.',
          },
        },
        { status: 400 }
      )
    }

    if (borrowedOnText) {
      if (!isDateString(borrowedOnText)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_BORROWED_ON',
              message: '대여일 형식이 올바르지 않습니다.',
            },
          },
          { status: 400 }
        )
      }

      updates.borrowed_on = borrowedOnText
    }

    if (dueOnText) {
      if (!isDateString(dueOnText)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_DUE_ON',
              message: '반납 예정일 형식이 올바르지 않습니다.',
            },
          },
          { status: 400 }
        )
      }

      updates.due_on = dueOnText
    }

    const nextBorrowedOn = updates.borrowed_on ?? existingLoan.borrowed_on
    let nextDueOn = updates.due_on ?? existingLoan.due_on

    if (nextDueOn < nextBorrowedOn) {
      if (statusText === 'returned' && !dueOnText) {
        updates.due_on = nextBorrowedOn
        nextDueOn = nextBorrowedOn
      } else {
        return NextResponse.json(
          {
            error: {
              code: 'DUE_ON_BEFORE_BORROWED_ON',
              message: '반납 예정일은 대여일보다 빠를 수 없습니다.',
            },
          },
          { status: 400 }
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_UPDATES',
            message: '변경할 내용이 없습니다.',
          },
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .select('id, book_id, student_id, borrowed_on, due_on, returned_on, status, books(title, school_book_code), students(name, student_number)')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json(
        {
          error: {
            code: 'LOAN_NOT_FOUND',
            message: '대여 정보를 찾을 수 없습니다.',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminAuthErrorResponse(error)
    }

    console.error('Loan update error:', error)

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23514'
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'LOAN_CONSTRAINT_VIOLATION',
            message: '대여일과 반납 예정일 값이 올바르지 않습니다.',
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: 'UPDATE_FAILED',
          message: '대여 상태 변경에 실패했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
