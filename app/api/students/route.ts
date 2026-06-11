import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getStudentNumber(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('studentNumber')?.trim() ?? ''
}

export async function GET(request: Request) {
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

    return NextResponse.json({ data })
  } catch {
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
