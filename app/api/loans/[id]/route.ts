import { requireAdminSession } from '@/lib/admin-auth'
import { updateAdminLoan } from '@/lib/admin-loans'
import { getText, jsonData, readJsonBody, runApiRoute, withNoStore } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

type PatchLoanBody = {
  borrowedOn?: unknown
  dueOn?: unknown
  status?: unknown
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return runApiRoute(
    {
      fallback: {
        code: 'UPDATE_FAILED',
        message: '대여 상태 변경에 실패했습니다.',
      },
      logLabel: 'Loan update error:',
    },
    async () => {
      const body = await readJsonBody<PatchLoanBody>(request)
      const session = await requireAdminSession(request)
      const data = await updateAdminLoan(session.supabase, params.id, {
        borrowedOn: getText(body.borrowedOn) || null,
        dueOn: getText(body.dueOn) || null,
        status: getText(body.status) || null,
      })

      return jsonData(data, withNoStore())
    }
  )
}
