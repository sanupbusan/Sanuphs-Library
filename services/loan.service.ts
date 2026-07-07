import { ApiRouteError } from '@/lib/api-route'
import type { DbClient } from '@/lib/db'
import type { LoanStatus, LoanWithBookAndStudent } from '@/types/library'
import * as loanRepository from '@/repositories/loan.repository'

type UpdateAdminLoanInput = {
  borrowedOn?: string | null
  dueOn?: string | null
  status?: LoanStatus | string | null
}

function getText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getDbErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''
}

export async function listAdminLoans(db: DbClient): Promise<LoanWithBookAndStudent[]> {
  return loanRepository.listAdminLoans(db)
}

export async function updateAdminLoan(
  db: DbClient,
  loanId: string,
  input: UpdateAdminLoanInput
): Promise<LoanWithBookAndStudent> {
  if (!loanId) {
    throw new ApiRouteError(400, 'MISSING_LOAN_ID', '대출 ID가 필요합니다.')
  }

  const existingLoan = await loanRepository.getExistingLoanDates(db, loanId)
  if (!existingLoan) {
    throw new ApiRouteError(404, 'LOAN_NOT_FOUND', '대출 정보를 찾을 수 없습니다.')
  }

  const updates: {
    borrowed_on?: string
    due_on?: string
    returned_on?: string | null
    status?: LoanStatus
  } = {}
  const statusText = getText(input.status)
  const borrowedOnText = getText(input.borrowedOn)
  const dueOnText = getText(input.dueOn)

  if (statusText === 'returned') {
    updates.status = 'returned'
    updates.returned_on = new Date().toISOString().slice(0, 10)
  } else if (statusText === 'rented') {
    updates.status = 'rented'
    updates.returned_on = null
  } else if (statusText) {
    throw new ApiRouteError(400, 'INVALID_STATUS', '대출 상태 값이 올바르지 않습니다.')
  }

  if (borrowedOnText) {
    if (!isDateString(borrowedOnText)) {
      throw new ApiRouteError(400, 'INVALID_BORROWED_ON', '대출일 형식이 올바르지 않습니다.')
    }
    updates.borrowed_on = borrowedOnText
  }

  if (dueOnText) {
    if (!isDateString(dueOnText)) {
      throw new ApiRouteError(400, 'INVALID_DUE_ON', '반납 예정일 형식이 올바르지 않습니다.')
    }
    updates.due_on = dueOnText
  }

  const nextBorrowedOn = updates.borrowed_on ?? existingLoan.borrowed_on
  const nextDueOn = updates.due_on ?? existingLoan.due_on

  if (nextDueOn < nextBorrowedOn) {
    if (statusText === 'returned' && !dueOnText) {
      updates.due_on = nextBorrowedOn
    } else {
      throw new ApiRouteError(400, 'DUE_ON_BEFORE_BORROWED_ON', '반납 예정일은 대출일보다 빠를 수 없습니다.')
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiRouteError(400, 'NO_UPDATES', '변경할 내용이 없습니다.')
  }

  try {
    const updatedCount = await loanRepository.updateLoanFields(db, loanId, updates)
    if (updatedCount === 0) {
      throw new ApiRouteError(404, 'LOAN_NOT_FOUND', '대출 정보를 찾을 수 없습니다.')
    }
  } catch (error) {
    if (getDbErrorCode(error) === '23514') {
      throw new ApiRouteError(400, 'LOAN_CONSTRAINT_VIOLATION', '대출일과 반납 예정일 값이 올바르지 않습니다.')
    }
    throw error
  }

  const updatedLoan = await loanRepository.getAdminLoanById(db, loanId)
  if (!updatedLoan) {
    throw new ApiRouteError(404, 'LOAN_NOT_FOUND', '대출 정보를 찾을 수 없습니다.')
  }

  return updatedLoan
}

export async function listAdminOverdueLoans(db: DbClient, today = new Date().toISOString().slice(0, 10)) {
  return loanRepository.listAdminOverdueLoans(db, today)
}
