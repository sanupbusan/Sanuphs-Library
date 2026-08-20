'use server'

import { revalidatePath } from 'next/cache'
import { AdminAuthError } from '@/lib/admin-auth'
import { resetAdminLoanRecords, updateAdminLoan } from '@/services/loan.service'
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

type ResetLoanRecordsActionResult = {
  data?: {
    cleared: true
  }
  error?: ApiError
}

function getActionError(
  error: unknown,
  logLabel: string,
  fallbackCode: string,
  fallbackMessage: string
): ApiError {
  if (error instanceof AdminAuthError || error instanceof ApiRouteError) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  console.error(logLabel, error)

  return {
    code: fallbackCode,
    message: fallbackMessage,
  }
}

function assertDevKey(devKey: string | null | undefined) {
  if (!process.env.DEV_KEY || devKey !== process.env.DEV_KEY) {
    throw new ApiRouteError(403, 'INVALID_DEV_KEY', 'DEV KEY가 올바르지 않습니다.')
  }
}

export async function updateLoanAction(
  loanId: string,
  input: UpdateLoanActionInput
): Promise<UpdateLoanActionResult> {
  try {
    const session = await requireAdminSessionFromCookies()

    if (input.forceOverdue) {
      assertDevKey(input.devKey)
    }

    const data = await updateAdminLoan(session.db, loanId.trim(), input)

    revalidatePath('/admin/loans')
    revalidatePath('/admin/overdue')

    return { data }
  } catch (error) {
    return {
      error: getActionError(
        error,
        'Update loan action failed:',
        'UPDATE_LOAN_FAILED',
        '대여 상태 변경에 실패했습니다.'
      ),
    }
  }
}

export async function resetLoanRecordsAction(
  devKey: string
): Promise<ResetLoanRecordsActionResult> {
  try {
    const session = await requireAdminSessionFromCookies()

    assertDevKey(devKey)

    await resetAdminLoanRecords(session.db)
    revalidatePath('/admin/loans')
    revalidatePath('/admin/overdue')

    return { data: { cleared: true } }
  } catch (error) {
    return {
      error: getActionError(
        error,
        'Reset loan records action failed:',
        'RESET_LOAN_RECORDS_FAILED',
        '대여 기록 초기화에 실패했습니다.'
      ),
    }
  }
}
