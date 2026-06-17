import { requireAdminSession } from '@/lib/admin-auth'
import { createAdminBook } from '@/lib/admin-books'
import {
  getText,
  jsonData,
  readJsonBody,
  runApiRoute,
} from '@/lib/api-route'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'

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
      const missingFields = [
        !input.title && '책 이름',
        !input.author && '저자',
        !input.publisher && '출판사',
        !input.isbn && 'ISBN 코드',
        !input.schoolBookCode && '학교 도서 코드',
      ].filter(Boolean)

      if (missingFields.length > 0) {
        throwApiError(400, 'MISSING_REQUIRED_FIELDS', `${missingFields.join(', ')}을(를) 입력해주세요.`)
      }

      const data = await createAdminBook(session.supabase, input)

      return jsonData(data, { status: 201 })
    }
  )
}
