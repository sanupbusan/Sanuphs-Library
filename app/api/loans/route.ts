import { NextResponse } from 'next/server'
import { AdminAuthError, adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { ApiRouteError, createRouteDbClient } from '@/lib/api-route'
import { normalizeBarcodeInput } from '@/lib/shared/barcode'
import { createPublicLoan, listAdminLoans } from '@/services/loan.service'

export const dynamic = 'force-dynamic'

type CreateLoanBody = {
  bookId?: unknown
  schoolBookCode?: unknown
  studentId?: unknown
  notes?: unknown
}

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const data = await listAdminLoans(session.db)

    return NextResponse.json(
      { data },
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
  const schoolBookCode = normalizeBarcodeInput(getText(body.schoolBookCode))
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
    const db = createRouteDbClient()
    const loan = await createPublicLoan(
      db,
      bookId,
      studentId,
      getText(body.notes) || null,
      schoolBookCode || null
    )

    return NextResponse.json({ data: loan }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return jsonLoanError(error.status, error.code, error.message)
    }

    console.error('Loan creation error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'CREATE_LOAN_FAILED',
          message: '대여 처리 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
