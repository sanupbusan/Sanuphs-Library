import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getSchoolBookCode(request: Request) {
  const url = new URL(request.url)

  return (url.searchParams.get('code') ?? url.searchParams.get('schoolBookCode') ?? '').trim()
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

  const schoolBookCode = getSchoolBookCode(request)

  if (!schoolBookCode) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_SCHOOL_BOOK_CODE',
          message: '학교 도서 코드를 입력해주세요.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('get_returnable_loan_by_school_book_code', {
      input_school_book_code: schoolBookCode,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({
      data: data?.[0] ?? null,
    })
  } catch (error) {
    console.error('Returnable loan lookup failed:', error)

    return NextResponse.json(
      {
        error: {
          code: 'RETURNABLE_LOAN_LOOKUP_FAILED',
          message: '반납할 대여 정보를 확인하지 못했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
