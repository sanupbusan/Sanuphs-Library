import { NextResponse } from 'next/server'
import { searchBooks } from '@/lib/library-queries'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MAX_QUERY_LENGTH = 100

type ErrorCode =
  | 'INVALID_LIMIT'
  | 'QUERY_TOO_LONG'
  | 'SUPABASE_NOT_CONFIGURED'
  | 'BOOK_SEARCH_FAILED'

function jsonError(status: number, code: ErrorCode, message: string) {
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

function parseLimit(limitParam: string | null) {
  if (!limitParam) {
    return DEFAULT_LIMIT
  }

  const parsedLimit = Number(limitParam)

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return null
  }

  return Math.min(parsedLimit, MAX_LIMIT)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? searchParams.get('query') ?? '').trim()
  const limit = parseLimit(searchParams.get('limit'))

  if (limit === null) {
    return jsonError(400, 'INVALID_LIMIT', 'limit must be a positive integer.')
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return jsonError(400, 'QUERY_TOO_LONG', `q must be ${MAX_QUERY_LENGTH} characters or fewer.`)
  }

  if (!isSupabaseConfigured()) {
    return jsonError(
      503,
      'SUPABASE_NOT_CONFIGURED',
      'Supabase environment variables are not configured.'
    )
  }

  try {
    const client = createServerSupabaseClient()
    const books = await searchBooks(client, query, limit)

    return NextResponse.json({
      data: books,
      meta: {
        query,
        count: books.length,
        limit,
      },
    })
  } catch (error) {
    console.error('Book search failed:', error)
    return jsonError(500, 'BOOK_SEARCH_FAILED', 'Failed to search books.')
  }
}
