import { normalizeBarcodeInput } from '@/lib/shared/barcode'
import {
  createRouteDbClient,
  jsonData,
  jsonDataWithMeta,
  readJsonBody,
  runApiRoute,
  throwApiError,
  withNoStore,
} from '@/lib/api-route'
import { ReturnService } from '@/services/return.service'

export const dynamic = 'force-dynamic'

type ReturnLoansBody = {
  code?: unknown
  schoolBookCodes?: unknown
}

function getCode(request: Request) {
  const url = new URL(request.url)

  return normalizeBarcodeInput(url.searchParams.get('code') ?? '')
}

function getText(value: unknown) {
  return typeof value === 'string' ? normalizeBarcodeInput(value) : ''
}

function getSchoolBookCodesFromBody(body: ReturnLoansBody) {
  if (Array.isArray(body.schoolBookCodes)) {
    return body.schoolBookCodes
      .map((code) => getText(code))
      .filter(Boolean)
  }

  const code = getText(body.code)

  return code ? [code] : []
}

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'BOOK_RETURN_LOOKUP_FAILED',
        message: '반납할 대여 정보를 조회하는 중 오류가 발생했습니다.',
      },
      logLabel: 'Book return lookup failed:',
    },
    async () => {
      const code = getCode(request)

      if (!code) {
        throwApiError(400, 'MISSING_CODE', '도서 코드를 입력해주세요.')
      }

      const db = createRouteDbClient()
      const loan = await ReturnService.getReturnableLoanBySchoolBookCode(db, code)

      if (!loan) {
        throwApiError(404, 'LOAN_NOT_FOUND', '해당 도서는 대여 중이 아닙니다.')
      }

      return jsonData(loan, withNoStore())
    }
  )
}

export async function POST(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'BOOK_RETURN_FAILED',
        message: '도서 반납 처리에 실패했습니다.',
      },
      logLabel: 'Book return failed:',
    },
    async () => {
      const body = await readJsonBody<ReturnLoansBody>(request)
      const schoolBookCodes = getSchoolBookCodesFromBody(body)

      if (schoolBookCodes.length === 0) {
        throwApiError(400, 'MISSING_CODE', '도서 코드를 입력해주세요.')
      }

      const db = createRouteDbClient()
      const returnedLoanList = await ReturnService.processReturn(db, schoolBookCodes)

      if (returnedLoanList.length === 0) {
        throwApiError(404, 'LOAN_NOT_FOUND', '대여 중인 도서를 찾지 못해 반납 처리하지 못했습니다.')
      }

      return jsonDataWithMeta(
        returnedLoanList,
        {
          count: returnedLoanList.length,
        },
        withNoStore()
      )
    }
  )
}
