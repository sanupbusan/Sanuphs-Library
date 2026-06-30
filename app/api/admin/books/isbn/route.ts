import { normalizeIsbnInput } from '@/lib/barcode-input'
import { requireAdminSession } from '@/lib/admin-auth'
import { jsonData, runApiRoute, throwApiError } from '@/lib/api-route'
import type { DbClient } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_ISBN_API_URL = 'https://www.nl.go.kr/seoji/SearchApi.do'
const ISBN_API_TIMEOUT_MS = 5_000
const ISBN_LOOKUP_CACHE_TTL_MS = 24 * 60 * 60 * 1000

type NormalizedBookInfo = {
  author: string
  isbn: string
  publisher: string
  title: string
}

type IsbnLookupCacheEntry = {
  book: NormalizedBookInfo
  expiresAt: number
}

const isbnLookupCache = new Map<string, IsbnLookupCacheEntry>()

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function getNationalLibraryApiKey() {
  return process.env.NATIONAL_LIBRARY_ISBN_API_KEY?.trim() ?? ''
}

function getNationalLibraryApiUrl() {
  return process.env.NATIONAL_LIBRARY_ISBN_API_URL?.trim() || DEFAULT_ISBN_API_URL
}

function getIsbnFromRequest(request: Request) {
  const url = new URL(request.url)

  return normalizeIsbnInput(cleanText(url.searchParams.get('isbn')))
}

function getCachedBookInfo(isbn: string) {
  const cached = isbnLookupCache.get(isbn)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    isbnLookupCache.delete(isbn)
    return null
  }

  return cached.book
}

function setCachedBookInfo(isbn: string, book: NormalizedBookInfo) {
  const expiresAt = Date.now() + ISBN_LOOKUP_CACHE_TTL_MS
  isbnLookupCache.set(isbn, { book, expiresAt })

  const normalizedBookIsbn = normalizeIsbnInput(book.isbn)
  if (normalizedBookIsbn && normalizedBookIsbn !== isbn) {
    isbnLookupCache.set(normalizedBookIsbn, { book, expiresAt })
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getFirstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return asRecord(value[0])
  }

  return asRecord(value)
}

function findFirstBookRecord(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload)
  if (!root) {
    return null
  }

  const candidateKeys = ['docs', 'doc', 'items', 'item', 'result', 'results', 'data']
  for (const key of candidateKeys) {
    const record = getFirstRecord(root[key])
    if (record) {
      return record
    }
  }

  const response = asRecord(root.response)
  if (response) {
    for (const key of candidateKeys) {
      const record = getFirstRecord(response[key])
      if (record) {
        return record
      }
    }
  }

  return root
}

function readField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(record[key])
    if (value) {
      return value
    }
  }

  return ''
}

function parseNationalLibraryXml(text: string, fallbackIsbn: string): NormalizedBookInfo | null {
  function readTag(tagName: string) {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
    const match = text.match(pattern)

    return cleanText(match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  }

  const title = readTag('TITLE') || readTag('title')
  const author = readTag('AUTHOR') || readTag('author')
  const publisher = readTag('PUBLISHER') || readTag('publisher')
  const isbn = readTag('EA_ISBN') || readTag('ISBN') || readTag('isbn') || fallbackIsbn

  if (!title && !author && !publisher) {
    return null
  }

  return {
    author,
    isbn,
    publisher,
    title,
  }
}

function normalizeBookInfo(payload: unknown, fallbackIsbn: string): NormalizedBookInfo | null {
  const record = findFirstBookRecord(payload)
  if (!record) {
    return null
  }

  const title = readField(record, ['TITLE', 'title', 'book_title', 'bookTitle', 'BOOK_NM'])
  const author = readField(record, ['AUTHOR', 'author', 'authors', 'AUTHOR_NM'])
  const publisher = readField(record, ['PUBLISHER', 'publisher', 'PUBLISHER_NM'])
  const isbn = readField(record, ['EA_ISBN', 'ISBN', 'isbn', 'isbn13', 'ISBN13']) || fallbackIsbn

  if (!title && !author && !publisher) {
    return null
  }

  return {
    author,
    isbn,
    publisher,
    title,
  }
}

function normalizeStoredBookInfo(
  book: {
    author: string | null
    isbn: string | null
    publisher: string | null
    title: string | null
  },
  fallbackIsbn: string
): NormalizedBookInfo | null {
  const title = cleanText(book.title)
  const author = cleanText(book.author)
  const publisher = cleanText(book.publisher)

  if (!title && !author && !publisher) {
    return null
  }

  return {
    author,
    isbn: normalizeIsbnInput(cleanText(book.isbn)) || fallbackIsbn,
    publisher,
    title,
  }
}

async function lookupStoredBookByIsbn(db: DbClient, isbn: string) {
  const { rows } = await db.query<{
    author: string | null
    isbn: string | null
    publisher: string | null
    title: string | null
  }>(
    `
      select isbn, title, author, publisher
      from public.books
      where isbn = $1
      limit 1
    `,
    [isbn]
  )

  return rows[0] ? normalizeStoredBookInfo(rows[0], isbn) : null
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ISBN_API_TIMEOUT_MS)

  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function parseBookInfoResponse(response: Response, isbn: string) {
  const contentType = response.headers.get('content-type') ?? ''
  const responseText = await response.text()

  if (!responseText.trim()) {
    return null
  }

  if (contentType.includes('json') || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
    try {
      return normalizeBookInfo(JSON.parse(responseText), isbn)
    } catch {
      return null
    }
  }

  return parseNationalLibraryXml(responseText, isbn)
}

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'ISBN_LOOKUP_FAILED',
        message: 'ISBN 정보 조회에 실패했습니다.',
      },
      logLabel: 'ISBN lookup error:',
    },
    async () => {
      const session = await requireAdminSession(request)

      const isbn = getIsbnFromRequest(request)
      if (!isbn) {
        throwApiError(400, 'MISSING_ISBN', 'ISBN 코드를 입력해주세요.')
      }

      const cachedBook = getCachedBookInfo(isbn)
      if (cachedBook) {
        return jsonData(cachedBook)
      }

      const storedBook = await lookupStoredBookByIsbn(session.db, isbn)
      if (storedBook) {
        setCachedBookInfo(isbn, storedBook)
        return jsonData(storedBook)
      }

      const apiKey = getNationalLibraryApiKey()
      if (!apiKey) {
        throwApiError(
          503,
          'ISBN_API_NOT_CONFIGURED',
          '국립중앙도서관 ISBN API 키가 설정되지 않았습니다.'
        )
      }

      let apiUrl: URL
      try {
        apiUrl = new URL(getNationalLibraryApiUrl())
      } catch {
        throwApiError(
          500,
          'INVALID_ISBN_API_URL',
          '국립중앙도서관 ISBN API URL 설정이 올바르지 않습니다.'
        )
      }

      apiUrl.searchParams.set('cert_key', apiKey)
      apiUrl.searchParams.set('result_style', 'json')
      apiUrl.searchParams.set('page_no', '1')
      apiUrl.searchParams.set('page_size', '1')
      apiUrl.searchParams.set('isbn', isbn)

      let response: Response
      try {
        response = await fetchWithTimeout(apiUrl)
      } catch (error) {
        console.error('National Library ISBN API fetch failed:', error)

        const isTimeout = error instanceof DOMException && error.name === 'AbortError'

        throwApiError(
          502,
          isTimeout ? 'ISBN_API_TIMEOUT' : 'ISBN_API_FETCH_FAILED',
          isTimeout
            ? '국립중앙도서관 ISBN API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
            : '국립중앙도서관 ISBN API에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'
        )
      }

      if (!response.ok) {
        throwApiError(
          502,
          'ISBN_API_REQUEST_FAILED',
          '국립중앙도서관 ISBN API 요청에 실패했습니다.'
        )
      }

      const book = await parseBookInfoResponse(response, isbn)

      if (!book) {
        throwApiError(404, 'BOOK_NOT_FOUND', 'ISBN으로 책 정보를 찾지 못했습니다.')
      }

      setCachedBookInfo(isbn, book)

      return jsonData(book)
    }
  )
}