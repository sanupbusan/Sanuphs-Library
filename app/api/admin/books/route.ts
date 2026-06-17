import { requireAdminSession } from '@/lib/admin-auth'
import { ADMIN_BOOK_COLUMNS, invalidateAdminBooksCache } from '@/lib/admin-books'
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
      const data = await createAdminBook(session.supabase, input)

      invalidateAdminBooksCache()

      return jsonData(data, { status: 201 })
    }
  )
}
