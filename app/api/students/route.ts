import { NextResponse } from 'next/server'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeBorrowerLookupCode } from '@/lib/loan-limits'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type LoanStudent = Database['public']['Functions']['lookup_student_for_loan']['Returns'][number]

function getStudentNumber(request: Request) {
  const url = new URL(request.url)

  return normalizeBorrowerLookupCode(normalizeBarcodeInput(url.searchParams.get('studentNumber') ?? ''))
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
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('lookup_student_for_loan', {
      input_student_number: studentNumber,
    })

    if (error) {
      throw error
    }

    const student = (data ?? [])[0] as LoanStudent | undefined

    if (!student) {
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

    return NextResponse.json({ data: student })
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
