import { requireAdminSession } from '@/lib/admin-auth'
import { ADMIN_BOOK_COLUMNS } from '@/lib/admin-books'
import {
  ApiRouteError,
  getText,
  jsonData,
  readJsonBody,
  runApiRoute,
  throwApiError,
} from '@/lib/api-route'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import { getMissingAdminBookRequiredFieldsMessage, getNullableAdminBookIsbn } from '@/lib/admin-book-input'

export const dynamic = 'force-dynamic'

type CreateBookBody = {
  author?: unknown
  isbn?: unknown
  publisher?: unknown
  schoolBookCode?: unknown
  title?: unknown
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

export async function POST(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'CREATE_BOOK_FAILED',
        message: '책 등록에 실패했습니다.',
      },
      logLabel: 'Admin book creation error:',
    },
    async () => {
      const session = await requireAdminSession(request)
      const body = await readJsonBody<CreateBookBody>(request)
      const input = getCreateBookInput(body)
      const missingFieldsMessage = getMissingAdminBookRequiredFieldsMessage(input)

      if (missingFieldsMessage) {
        throwApiError(400, 'MISSING_REQUIRED_FIELDS', missingFieldsMessage)
      }

      const { data, error } = await session.supabase
        .from('books')
        .insert({
          author: input.author,
          available_copies: 1,
          category: '미분류',
          isbn: getNullableAdminBookIsbn(input),
          publisher: input.publisher,
          school_book_code: input.schoolBookCode,
          title: input.title,
          total_copies: 1,
        })
        .select(ADMIN_BOOK_COLUMNS)
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new ApiRouteError(409, 'DUPLICATE_BOOK_CODE', '이미 등록된 ISBN 또는 학교 내 도서 코드입니다.')
        }

        throw error
      }

      return jsonData(data, { status: 201 })
    }
  )
}
