import { adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'
import { getText, jsonData, jsonError, readJsonBody } from '@/lib/api-route'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'

export const dynamic = 'force-dynamic'

type CreateBookBody = {
  author?: unknown
  isbn?: unknown
  publisher?: unknown
  schoolBookCode?: unknown
  title?: unknown
}

type DeleteBookBody = {
  id?: unknown
}

function getCreateBookInput(body: CreateBookBody) {
  return {
    author: getText(body.author),
    isbn: normalizeIsbnInput(getText(body.isbn)),
    publisher: getText(body.publisher),
    schoolBookCode: normalizeBarcodeInput(getText(body.schoolBookCode)),
    title: getText(body.title),
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const { data, error } = await session.supabase
      .from('books')
      .select('id, isbn, school_book_code, title, author, publisher, category, total_copies, available_copies, location, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    return jsonData(data ?? [])
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const body = await readJsonBody<CreateBookBody>(request)
    const input = getCreateBookInput(body)
    const missingFields = [
      !input.title && '책 이름',
      !input.author && '저자',
      !input.publisher && '출판사',
      !input.isbn && 'ISBN 코드',
      !input.schoolBookCode && '학교 내 도서 코드',
    ].filter(Boolean)

    if (missingFields.length > 0) {
      return jsonError('MISSING_REQUIRED_FIELDS', `${missingFields.join(', ')}을(를) 입력해주세요.`, 400)
    }

    const { data, error } = await session.supabase
      .from('books')
      .insert({
        author: input.author,
        available_copies: 1,
        category: '미분류',
        isbn: input.isbn,
        publisher: input.publisher,
        school_book_code: input.schoolBookCode,
        title: input.title,
        total_copies: 1,
      })
      .select('id, isbn, school_book_code, title, author, publisher, category, total_copies, available_copies, location, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return jsonError('DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 내 도서 코드입니다.', 409)
      }

      throw error
    }

    return jsonData(data, { status: 201 })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const url = new URL(request.url)
    let bookId = getText(url.searchParams.get('id'))

    if (!bookId) {
      try {
        const body = await readJsonBody<DeleteBookBody>(request)
        bookId = getText(body.id)
      } catch {
        bookId = ''
      }
    }

    if (!bookId) {
      return jsonError('MISSING_BOOK_ID', '제거할 도서를 선택해주세요.', 400)
    }

    const { data, error } = await session.supabase
      .from('books')
      .delete()
      .eq('id', bookId)
      .select('id, title')
      .maybeSingle()

    if (error) {
      if (error.code === '23503') {
        return jsonError('BOOK_HAS_LOANS', '대여 기록이 있는 도서는 바로 제거할 수 없습니다.', 409)
      }

      throw error
    }

    if (!data) {
      return jsonError('BOOK_NOT_FOUND', '제거할 도서를 찾을 수 없습니다.', 404)
    }

    return jsonData(data)
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
