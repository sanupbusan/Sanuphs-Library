import { NextResponse } from 'next/server'
import { createRouteDbClient } from '@/lib/api-route'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { BookLookupResult, RemovableBook } from '@/types/library'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getCode(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('code')?.trim() ?? ''
}

function normalizeCode(value: string) {
  return normalizeBarcodeInput(value).toUpperCase()
}

function isLikelyIsbn(value: string) {
  const digits = value.replace(/[^0-9Xx]/g, '')

  return digits.length === 10 || digits.length === 13
}

async function findBook(code: string, isIsbn: boolean) {
  const db = createRouteDbClient()
  const sql = isIsbn
    ? `
        select
          id,
          isbn,
          school_book_code,
          school_book_codes,
          title,
          author,
          publisher,
          available_copies,
          total_copies
        from public.books
        where isbn = $1
        limit 1
      `
    : `
        select
          id,
          isbn,
          school_book_code,
          school_book_codes,
          title,
          author,
          publisher,
          available_copies,
          total_copies
        from public.books
        where coalesce(school_book_codes, '{}'::text[]) @> array[$1]::text[]
           or school_book_code = $1
        order by
          case when coalesce(school_book_codes, '{}'::text[]) @> array[$1]::text[] then 0 else 1 end
        limit 1
      `

  const { rows } = await db.query<RemovableBook>(sql, [code])

  return rows[0] ?? null
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
    const normalizedCode = normalizeCode(code)
    const isIsbn = isLikelyIsbn(normalizedCode)
    const data = await findBook(normalizedCode, isIsbn)

    if (!data) {
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

    const matchedSchoolBookCode = isIsbn
      ? data.school_book_code ?? data.school_book_codes?.[0] ?? null
      : normalizedCode

    const result: BookLookupResult = {
      ...data,
      matched_school_book_code: matchedSchoolBookCode,
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
