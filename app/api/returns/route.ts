import { normalizeBarcodeInput } from '@/lib/barcode-input'
import {
  createRouteSupabaseClient,
  jsonDataWithMeta,
  readJsonBody,
  runApiRoute,
  throwApiError,
  withNoStore,
} from '@/lib/api-route'
import type { ReturnedLoan } from '@/types/library'

export const dynamic = 'force-dynamic'

type ReturnBooksBody = {
  schoolBookCodes?: unknown
}

function getSchoolBookCodes(body: ReturnBooksBody) {
  if (!Array.isArray(body.schoolBookCodes)) {
    return []
  }

  return body.schoolBookCodes
    .map((code) => (typeof code === 'string' ? normalizeBarcodeInput(code) : ''))
    .filter(Boolean)
}

export async function POST(request: Request) {
  return runApiRoute(
    {
      exposeErrorMessage: true,
      fallback: {
        code: 'BOOK_RETURN_FAILED',
        message: '도서 반납 처리에 실패했습니다.',
      },
      logLabel: 'Book returns failed:',
    },
    async () => {
      const body = await readJsonBody<ReturnBooksBody>(request)
      const schoolBookCodes = getSchoolBookCodes(body)

      if (schoolBookCodes.length === 0) {
        throwApiError(400, 'MISSING_CODE', '도서 코드를 입력해주세요.')
      }

      const supabase = createRouteSupabaseClient()
      const { data, error } = await supabase.rpc('return_loans_by_school_book_codes', {
        input_school_book_codes: schoolBookCodes,
      })

      if (error) {
        throw error
      }

      const returnedLoans = (data ?? []) as ReturnedLoan[]

      if (returnedLoans.length === 0) {
        throwApiError(404, 'LOAN_NOT_FOUND', '대여 중인 도서를 찾지 못해 반납 처리하지 못했습니다.')
      }

      return jsonDataWithMeta(
        returnedLoans,
        {
          count: returnedLoans.length,
        },
        withNoStore()
      )
    }
  )
}
