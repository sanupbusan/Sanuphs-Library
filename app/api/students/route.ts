import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { normalizeBorrowerLookupCode } from '@/lib/loan-limits'
import { createRouteDbClient, jsonData, runApiRoute, throwApiError, withNoStore } from '@/lib/api-route'
import type { LoanStudent } from '@/types/library'

export const dynamic = 'force-dynamic'

function getStudentNumber(request: Request) {
  const url = new URL(request.url)

  return normalizeBorrowerLookupCode(normalizeBarcodeInput(url.searchParams.get('studentNumber') ?? ''))
}

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'FETCH_FAILED',
        message: '학생 정보를 조회하는 중 오류가 발생했습니다.',
      },
      logLabel: 'Student fetch error:',
    },
    async () => {
      const studentNumber = getStudentNumber(request)

      if (!studentNumber) {
        throwApiError(400, 'MISSING_STUDENT_NUMBER', '학번을 입력해주세요.')
      }

      const db = createRouteDbClient()
      const { rows } = await db.query<LoanStudent>(
        'select * from public.lookup_student_for_loan($1::text)',
        [studentNumber]
      )
      const student = rows[0]

      if (!student) {
        throwApiError(404, 'STUDENT_NOT_FOUND', '해당 학번의 학생을 찾을 수 없습니다.')
      }

      return jsonData(student, withNoStore())
    }
  )
}
