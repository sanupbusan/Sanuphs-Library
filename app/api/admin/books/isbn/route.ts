import { NextResponse } from 'next/server'
import { adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const DEFAULT_ISBN_API_URL = 'https://www.nl.go.kr/seoji/SearchApi.do'
const ISBN_API_TIMEOUT_MS = 15_000

type NormalizedBookInfo = {
  author: string
  isbn: string
  publisher: string
  title: string
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function jsonError(code: string, message: string, status: number) {
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

function getNationalLibraryApiKey() {
  return process.env.NATIONAL_LIBRARY_ISBN_API_KEY?.trim() ?? ''
}

function getNationalLibraryApiUrl() {
  return process.env.NATIONAL_LIBRARY_ISBN_API_URL?.trim() || DEFAULT_ISBN_API_URL
}

function getIsbnFromRequest(request: Request) {
  const url = new URL(request.url)

  return cleanText(url.searchParams.get('isbn')).replace(/[^0-9Xx]/g, '')
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
  try {
    await requireAdminSession(request)

    const isbn = getIsbnFromRequest(request)
    if (!isbn) {
      return jsonError('MISSING_ISBN', 'ISBN 코드를 입력해주세요.', 400)
    }

    const apiKey = getNationalLibraryApiKey()
    if (!apiKey) {
      return jsonError(
        'ISBN_API_NOT_CONFIGURED',
        '국립중앙도서관 ISBN API 키가 설정되지 않았습니다.',
        503
      )
    }

    let apiUrl: URL
    try {
      apiUrl = new URL(getNationalLibraryApiUrl())
    } catch {
      return jsonError(
        'INVALID_ISBN_API_URL',
        '국립중앙도서관 ISBN API URL 설정이 올바르지 않습니다.',
        500
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

      const isTimeout =
        error instanceof DOMException && error.name === 'AbortError'

      return jsonError(
        isTimeout ? 'ISBN_API_TIMEOUT' : 'ISBN_API_FETCH_FAILED',
        isTimeout
          ? '국립중앙도서관 ISBN API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          : '국립중앙도서관 ISBN API에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.',
        502
      )
    }

    if (!response.ok) {
      return jsonError(
        'ISBN_API_REQUEST_FAILED',
        '국립중앙도서관 ISBN API 요청에 실패했습니다.',
        502
      )
    }

    const book = await parseBookInfoResponse(response, isbn)

    if (!book) {
      return jsonError('BOOK_NOT_FOUND', 'ISBN으로 책 정보를 찾지 못했습니다.', 404)
    }

    return NextResponse.json({
      data: book,
    })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
