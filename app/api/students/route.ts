import { NextResponse } from 'next/server'
<<<<<<< HEAD
import { AdminAuthError, adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { getBorrowerLoanLimit, normalizeBorrowerLookupCode } from '@/lib/loan-limits'

export const dynamic = 'force-dynamic'

=======
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBorrowerLookupCode } from '@/lib/loan-limits'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type LoanStudent = Database['public']['Functions']['lookup_student_for_loan']['Returns'][number]

>>>>>>> origin/main
function getStudentNumber(request: Request) {
  const url = new URL(request.url)

  return normalizeBorrowerLookupCode(normalizeBarcodeInput(url.searchParams.get('studentNumber') ?? ''))
}

<<<<<<< HEAD
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

function getDateKeyTime(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return Date.UTC(year, month - 1, day)
}

function getOverdueDays(dueOn: string, today: string) {
  return Math.max(0, Math.floor((getDateKeyTime(today) - getDateKeyTime(dueOn)) / 86_400_000))
}

function getLoanBanRemainingDays(loanBannedUntil: string | null, today: string) {
  if (!loanBannedUntil || loanBannedUntil < today) {
    return 0
  }

  return Math.floor((getDateKeyTime(loanBannedUntil) - getDateKeyTime(today)) / 86_400_000) + 1
}

export async function GET(request: Request) {
=======
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

>>>>>>> origin/main
  const studentNumber = getStudentNumber(request)

  if (!studentNumber) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_STUDENT_NUMBER',
          message: '학번을 입력해주세요.',
        },
      },
      { status: 400 }
    )
  }

  try {
<<<<<<< HEAD
    const session = await requireAdminSession(request)
    const supabase = session.supabase
    const { data, error } = await supabase
      .from('students')
      .select('id, student_number, name, grade, class_number, seat_number, loan_banned_until')
      .eq('student_number', studentNumber)
      .maybeSingle()
=======
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('lookup_student_for_loan', {
      input_student_number: studentNumber,
    })
>>>>>>> origin/main

    if (error) {
      throw error
    }

<<<<<<< HEAD
    if (!data) {
=======
    const student = (data ?? [])[0] as LoanStudent | undefined

    if (!student) {
>>>>>>> origin/main
      return NextResponse.json(
        {
          error: {
            code: 'STUDENT_NOT_FOUND',
            message: '해당 학번의 학생을 찾을 수 없습니다.',
          },
        },
        { status: 404 }
      )
    }

<<<<<<< HEAD
    const { count, error: countError } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', data.id)
      .eq('status', 'rented')

    if (countError) {
      throw countError
    }

    const activeLoanCount = count ?? 0
    const today = getTodayDateKey()
    const { data: overdueLoan, error: overdueLoanError } = await supabase
      .from('loans')
      .select('due_on')
      .eq('student_id', data.id)
      .eq('status', 'rented')
      .lt('due_on', today)
      .order('due_on', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (overdueLoanError) {
      throw overdueLoanError
    }

    const overdueDays = overdueLoan ? getOverdueDays(overdueLoan.due_on, today) : 0
    const loanBanRemainingDays = getLoanBanRemainingDays(data.loan_banned_until, today)
    const { borrowerLabel, borrowerType, loanLimit } = getBorrowerLoanLimit(data)

    return NextResponse.json({
      data: {
        ...data,
        active_loan_count: activeLoanCount,
        borrower_label: borrowerLabel,
        borrower_type: borrowerType,
        loan_ban_remaining_days: loanBanRemainingDays,
        loan_limit: loanLimit,
        overdue_days: overdueDays,
        remaining_loan_count: Math.max(loanLimit - activeLoanCount, 0),
      },
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminAuthErrorResponse(error)
    }

=======
    return NextResponse.json({ data: student })
  } catch (error) {
>>>>>>> origin/main
    console.error('Student fetch error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: '학생 정보를 조회하는 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
