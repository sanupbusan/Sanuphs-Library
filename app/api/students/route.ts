import { normalizeBarcodeInput } from '@/lib/barcode-input'
import {
  createRouteSupabaseClient,
  jsonData,
  runApiRoute,
  throwApiError,
} from '@/lib/api-route'
import type { LoanStudent } from '@/types/library'

export const dynamic = 'force-dynamic'

function getStudentNumber(request: Request) {
  const url = new URL(request.url)

  return normalizeBarcodeInput(url.searchParams.get('studentNumber') ?? '')
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

      const supabase = createRouteSupabaseClient()
      const { data, error } = await supabase.rpc('lookup_student_for_loan', {
        input_student_number: studentNumber,
      })

      if (error) {
        throw error
      }

      const student = (data ?? [])[0] as LoanStudent | undefined

      if (!student) {
        throwApiError(404, 'STUDENT_NOT_FOUND', '해당 학번의 학생을 찾을 수 없습니다.')
      }

      return jsonData(student)
    }
  )
}
