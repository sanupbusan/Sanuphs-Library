import { createRouteDbClient, jsonDataWithMeta, runApiRoute } from '@/lib/api-route'
import { searchBooks } from '@/lib/library-queries'

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
  const { limit, query } = getSearchParams(request)

  return runApiRoute(
    {
      fallback: {
        code: 'BOOK_SEARCH_FAILED',
        message: '도서 검색에 실패했습니다.',
      },
      logLabel: 'Book search failed:',
    },
    async () => {
      const db = createRouteDbClient()
      const data = await searchBooks(db, query, limit)
      const books = data.map((book) => ({
        id: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        available_copies: book.available_copies,
        total_copies: book.total_copies,
      }))

      return jsonDataWithMeta(books, {
        count: books.length,
        limit,
        query,
      })
    }
  )
}
