import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type CreateLoanBody = {
  bookId?: unknown
  studentId?: unknown
  notes?: unknown
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getTodayDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
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
  } catch {
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

  try {
    const supabase = createServerSupabaseClient()

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
            message: '이미 대여 중인 도서입니다.',
          },
        },
        { status: 409 }
      )
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, loan_banned_until')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
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

    const today = getTodayDateKey()

    if (student.loan_banned_until && student.loan_banned_until >= today) {
      return NextResponse.json(
        {
          error: {
            code: 'STUDENT_LOAN_BANNED',
            message: `연체로 인한 대출 금지 기간입니다. ${student.name} 학생은 ${formatKoreanDate(
              student.loan_banned_until
            )}까지 대여할 수 없습니다.`,
          },
        },
        { status: 409 }
      )
    }

    const { data: overdueLoan, error: overdueLoanError } = await supabase
      .from('loans')
      .select('id, due_on')
      .eq('student_id', studentId)
      .eq('status', 'rented')
      .lt('due_on', today)
      .order('due_on', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (overdueLoanError) {
      throw overdueLoanError
    }

    if (overdueLoan) {
      return NextResponse.json(
        {
          error: {
            code: 'STUDENT_HAS_OVERDUE_LOAN',
            message: `반납 예정일(${formatKoreanDate(
              overdueLoan.due_on
            )})이 지난 도서가 있어 대여할 수 없습니다. 먼저 연체 도서를 반납해주세요.`,
          },
        },
        { status: 409 }
      )
    }

    const { data: existingLoan, error: existingLoanError } = await supabase
      .from('loans')
      .select('id')
      .eq('book_id', bookId)
      .eq('student_id', studentId)
      .eq('status', 'rented')
      .maybeSingle()

    if (existingLoanError) {
      throw existingLoanError
    }

    if (existingLoan) {
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

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .insert({
        book_id: bookId,
        student_id: studentId,
        notes: getText(body.notes) || null,
      })
      .select('id, book_id, student_id, borrowed_on, due_on, status')
      .single()

    if (loanError) {
      throw loanError
    }

    return NextResponse.json(
      {
        data: {
          bookTitle: book.title,
          dueOn: loan.due_on,
          loanId: loan.id,
          studentName: student.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
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
