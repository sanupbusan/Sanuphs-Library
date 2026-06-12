import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function getSearchParams(request: Request) {
  const url = new URL(request.url)
  const query = (url.searchParams.get('q') ?? url.searchParams.get('query') ?? '').trim()
  const requestedLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  return { limit, query }
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

  const { limit, query } = getSearchParams(request)

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .rpc('search_books', { search_query: query })
      .limit(limit)

    if (error) {
      throw error
    }

    const books = (data ?? []).map((book) => ({
      id: book.id,
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      available_copies: book.available_copies,
      total_copies: book.total_copies,
      location: book.location,
    }))

    return NextResponse.json({
      data: books,
      meta: {
        count: books.length,
        limit,
        query,
      },
    })
  } catch (error) {
    console.error('Book search failed:', error)

    return NextResponse.json(
      {
        error: {
          code: 'BOOK_SEARCH_FAILED',
          message: '도서 검색에 실패했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
