import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'DEPRECATED',
        message: '이 엔드포인트는 더 이상 사용되지 않습니다. GET /api/returns/loans?code=xxx 를 사용하세요.',
      },
    },
    { status: 410 }
  )
}
