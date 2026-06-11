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
      .select('id, name')
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
