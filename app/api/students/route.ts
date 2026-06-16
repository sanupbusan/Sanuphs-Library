import { NextResponse } from 'next/server'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { getBorrowerLoanLimit, normalizeBorrowerLookupCode } from '@/lib/loan-limits'
import { createServiceRoleSupabaseClient, isSupabaseServiceRoleConfigured } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

function getStudentNumber(request: Request) {
  const url = new URL(request.url)

  return normalizeBorrowerLookupCode(normalizeBarcodeInput(url.searchParams.get('studentNumber') ?? ''))
}

export async function GET(request: Request) {
  if (!isSupabaseServiceRoleConfigured()) {
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
    const supabase = createServiceRoleSupabaseClient()
    const { data, error } = await supabase
      .from('students')
      .select('id, student_number, name, grade, class_number, seat_number')
      .eq('student_number', studentNumber)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
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

    const { count, error: countError } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', data.id)
      .eq('status', 'rented')

    if (countError) {
      throw countError
    }

    const activeLoanCount = count ?? 0
    const { borrowerLabel, borrowerType, loanLimit } = getBorrowerLoanLimit(data)

    return NextResponse.json({
      data: {
        ...data,
        active_loan_count: activeLoanCount,
        borrower_label: borrowerLabel,
        borrower_type: borrowerType,
        loan_limit: loanLimit,
        remaining_loan_count: Math.max(loanLimit - activeLoanCount, 0),
      },
    })
  } catch (error) {
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
