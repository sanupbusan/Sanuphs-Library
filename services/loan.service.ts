import { ApiRouteError } from '@/lib/api-route'
import type { DbClient } from '@/lib/db'
import { getTodayDateKey } from '@/lib/shared/date'
import type {
  CreatedPublicLoan,
  LoanCreationResult,
  LoanStatus,
  LoanWithBookAndStudent,
} from '@/types/library'
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

function getDbErrorCode(error: unknown, depth = 0): string {
  if (depth > 4 || typeof error !== 'object' || error === null) {
    return ''
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code
  }

  return 'cause' in error ? getDbErrorCode(error.cause, depth + 1) : ''
}

function getDbErrorMessage(error: unknown, depth = 0): string {
  if (depth > 4 || typeof error !== 'object' || error === null) {
    return ''
  }

  if ('cause' in error) {
    const causeMessage = getDbErrorMessage(error.cause, depth + 1)
    if (causeMessage) {
      return causeMessage
    }
  }

  return 'message' in error && typeof error.message === 'string' ? error.message : ''
}

function loanCreationError(status: number, code: string, message: string) {
  return new ApiRouteError(status, code, message)
}

function mapLoanCreationDatabaseError(error: unknown) {
  if (error instanceof ApiRouteError) {
    return error
  }

  const code = getDbErrorCode(error)
  const [reason, detail] = getDbErrorMessage(error).split('|')

  switch (reason) {
    case 'BOOK_NOT_FOUND':
      return loanCreationError(404, 'BOOK_NOT_FOUND', '해당 도서를 찾을 수 없습니다.')
    case 'STUDENT_NOT_FOUND':
      return loanCreationError(404, 'STUDENT_NOT_FOUND', '해당 학생을 찾을 수 없습니다.')
    case 'NO_AVAILABLE_COPIES':
      return loanCreationError(409, 'NO_AVAILABLE_COPIES', '대여 가능한 도서가 없습니다.')
    case 'ALREADY_RENTED':
      return loanCreationError(409, 'ALREADY_RENTED', '이미 대여 중인 도서입니다.')
    case 'STUDENT_LOAN_BANNED':
      return loanCreationError(
        409,
        'STUDENT_LOAN_BANNED',
        detail ? `대여 정지 기간입니다. ${detail}까지 대여할 수 없습니다.` : '대여 정지 기간입니다.'
      )
    case 'STUDENT_HAS_OVERDUE_LOAN':
      return loanCreationError(
        409,
        'STUDENT_HAS_OVERDUE_LOAN',
        detail
          ? `연체 중인 도서가 있어 대여할 수 없습니다. 가장 오래된 반납 예정일: ${detail}`
          : '연체 중인 도서가 있어 대여할 수 없습니다.'
      )
  }

  if (code === '23505') {
    return loanCreationError(409, 'ALREADY_RENTED', '이미 대여 중인 도서입니다.')
  }

  if (code === '23514') {
    return loanCreationError(
      409,
      'LOAN_LIMIT_EXCEEDED',
      '대여 가능한 권수를 초과했습니다.'
    )
  }

  if (code === '42501') {
    return loanCreationError(
      503,
      'LOAN_DATABASE_ACCESS_DENIED',
      '서버 DB 계정에 대여 생성 권한이 없습니다. 최신 대여 서비스 마이그레이션을 적용해주세요.'
    )
  }

  return error
}

function mapCreatedLoan(loan: CreatedPublicLoan): LoanCreationResult {
  return {
    activeLoanCount: loan.active_loan_count,
    bookTitle: loan.book_title,
    borrowerLabel: loan.borrower_label,
    borrowerType: loan.borrower_type === 'staff' ? 'staff' : 'student',
    dueOn: loan.due_on,
    loanId: loan.loan_id,
    loanLimit: loan.loan_limit,
    remainingLoanCount: loan.remaining_loan_count,
    studentName: loan.student_name,
  }
}

export async function createPublicLoan(
  db: DbClient,
  bookId: string,
  studentId: string,
  notes: string | null,
  schoolBookCode: string | null
): Promise<LoanCreationResult> {
  try {
    const rows = await loanRepository.createPublicLoanViaRpc(
      db,
      bookId,
      studentId,
      notes,
      schoolBookCode
    )
    const loan = rows[0]

    if (!loan) {
      throw loanCreationError(
        500,
        'CREATE_LOAN_FAILED',
        '대여 처리 결과를 확인하지 못했습니다. 다시 시도해주세요.'
      )
    }

    return mapCreatedLoan(loan)
  } catch (error) {
    throw mapLoanCreationDatabaseError(error)
  }
}

export async function listAdminLoans(db: DbClient): Promise<LoanWithBookAndStudent[]> {
  return loanRepository.listAdminLoans(db)
}

export async function resetAdminLoanRecords(db: DbClient): Promise<void> {
  await loanRepository.resetAdminLoanRecords(db)
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
    updates.returned_on = getTodayDateKey()
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

export async function listAdminOverdueLoans(db: DbClient, today = getTodayDateKey()) {
  return loanRepository.listAdminOverdueLoans(db, today)
}
