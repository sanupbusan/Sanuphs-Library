'use server'

import { revalidatePath } from 'next/cache'
import { AdminAuthError } from '@/lib/admin-auth'
import { updateAdminLoan } from '@/services/loan.service'
import { ApiRouteError } from '@/lib/api-route'
import { requireAdminSessionFromCookies } from '@/lib/admin-server-auth'
import type { ApiError, LoanStatus, LoanWithBookAndStudent } from '@/types/library'

type UpdateLoanActionInput = {
  borrowedOn?: string | null
  dueOn?: string | null
  status?: LoanStatus | string | null
  forceOverdue?: boolean
  devKey?: string | null
}

type UpdateLoanActionResult = {
  data?: LoanWithBookAndStudent
  error?: ApiError
}

function getActionError(error: unknown): ApiError {
  if (error instanceof AdminAuthError || error instanceof ApiRouteError) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  console.error('Update loan action failed:', error)

  return {
    code: 'UPDATE_LOAN_FAILED',
    message: '대여 상태 변경에 실패했습니다.',
  }
}

export async function updateLoanAction(
  loanId: string,
  input: UpdateLoanActionInput
): Promise<UpdateLoanActionResult> {
  try {
    const session = await requireAdminSessionFromCookies()

    if (input.forceOverdue && (!process.env.DEV_KEY || input.devKey !== process.env.DEV_KEY)) {
      throw new ApiRouteError(403, 'INVALID_DEV_KEY', 'DEV KEY가 올바르지 않습니다.')
    }

    const data = await updateAdminLoan(session.db, loanId.trim(), input)

    revalidatePath('/admin/loans')
    revalidatePath('/admin/overdue')

    return { data }
  } catch (error) {
    return {
      error: getActionError(error),
    }
  }
}
