import { NextResponse } from 'next/server'
import { createRouteDbClient } from '@/lib/api-route'
import { lookupBookByBarcodeOrIsbn } from '@/services/book-lookup.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getCode(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('code')?.trim() ?? ''
}

export async function GET(request: Request) {
  const code = getCode(request)

  if (!code) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_CODE',
          message: '도서 코드를 입력해주세요.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const db = createRouteDbClient()
    const result = await lookupBookByBarcodeOrIsbn(db, code)

    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: 'BOOK_NOT_FOUND',
            message: '해당 도서 코드의 책을 찾을 수 없습니다.',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Book lookup error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: '도서 정보를 조회하는 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
