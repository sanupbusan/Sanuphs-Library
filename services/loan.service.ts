import { ApiRouteError } from '@/lib/api-route'
import type { DbClient, DbTransaction } from '@/lib/db'
import { addDaysToDateKey, getTodayDateKey } from '@/lib/shared/date'
import { getBorrowerLoanLimit } from '@/services/borrower-policy.service'
import type { LoanCreationResult, LoanStatus, LoanWithBookAndStudent } from '@/types/library'
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

function loanCreationError(status: number, code: string, message: string) {
  return new ApiRouteError(status, code, message)
}

function getBookCopyCandidates(book: loanRepository.LoanCreationBook) {
  const sourceCodes = book.school_book_codes.length > 0
    ? book.school_book_codes
    : [book.school_book_code]

  return sourceCodes
    .map((code) => code?.trim() ?? '')
    .filter(Boolean)
}

function isBookCopyActive(
  activeCopies: Pick<loanRepository.ActiveLoanForCreation, 'book_id' | 'school_book_code'>[],
  book: loanRepository.LoanCreationBook,
  schoolBookCode: string
) {
  return activeCopies.some((loan) =>
    loan.school_book_code === schoolBookCode ||
    (
      loan.school_book_code === null &&
      loan.book_id === book.id &&
      schoolBookCode === book.school_book_code?.trim()
    )
  )
}

async function resolveSchoolBookCode(
  db: DbTransaction,
  book: loanRepository.LoanCreationBook,
  requestedSchoolBookCode: string | null
) {
  const primarySchoolBookCode = book.school_book_code?.trim() || null
  const storedSchoolBookCodes = book.school_book_codes
    .map((code) => code.trim())
    .filter(Boolean)
  const requestedCode = requestedSchoolBookCode?.trim() || null

  if (
    requestedCode &&
    requestedCode !== primarySchoolBookCode &&
    !storedSchoolBookCodes.includes(requestedCode)
  ) {
    throw loanCreationError(404, 'BOOK_NOT_FOUND', '해당 도서를 찾을 수 없습니다.')
  }

  const candidates = requestedCode ? [requestedCode] : getBookCopyCandidates(book)
  const activeCopies = await loanRepository.listActiveLoansForBookCopies(
    db,
    book.id,
    candidates
  )

  if (requestedCode) {
    if (isBookCopyActive(activeCopies, book, requestedCode)) {
      throw loanCreationError(409, 'ALREADY_RENTED', '이미 대여 중인 도서입니다.')
    }

    return requestedCode
  }

  const availableCode = candidates.find(
    (candidate) => !isBookCopyActive(activeCopies, book, candidate)
  )

  if (!availableCode && book.school_book_codes.length > 0) {
    throw loanCreationError(409, 'NO_AVAILABLE_COPIES', '대여 가능한 도서가 없습니다.')
  }

  return availableCode ?? null
}

function mapLoanCreationDatabaseError(error: unknown) {
  if (error instanceof ApiRouteError) {
    return error
  }

  const code = getDbErrorCode(error)

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

export async function createPublicLoan(
  db: DbClient,
  bookId: string,
  studentId: string,
  notes: string | null,
  schoolBookCode: string | null
): Promise<LoanCreationResult> {
  try {
    return await db.transaction(async (transaction) => {
      await loanRepository.acquireLoanCreationLock(
        transaction,
        `loan:book:${bookId}`
      )
      const book = await loanRepository.findBookForLoanCreation(transaction, bookId)
      if (!book) {
        throw loanCreationError(404, 'BOOK_NOT_FOUND', '해당 도서를 찾을 수 없습니다.')
      }

      const selectedSchoolBookCode = await resolveSchoolBookCode(
        transaction,
        book,
        schoolBookCode
      )

      if (book.available_copies <= 0) {
        throw loanCreationError(409, 'NO_AVAILABLE_COPIES', '대여 가능한 도서가 없습니다.')
      }

      await loanRepository.acquireLoanCreationLock(
        transaction,
        `loan:student:${studentId}`
      )
      const student = await loanRepository.findStudentForLoanCreation(
        transaction,
        studentId
      )
      if (!student) {
        throw loanCreationError(404, 'STUDENT_NOT_FOUND', '해당 학생을 찾을 수 없습니다.')
      }

      const today = getTodayDateKey()
      if (student.loan_banned_until && student.loan_banned_until >= today) {
        throw loanCreationError(
          409,
          'STUDENT_LOAN_BANNED',
          `대여 정지 기간입니다. ${student.loan_banned_until}까지 대여할 수 없습니다.`
        )
      }

      const activeLoans = await loanRepository.listActiveLoansForStudent(
        transaction,
        studentId
      )
      const oldestOverdueLoan = activeLoans
        .filter((loan) => loan.due_on < today)
        .sort((left, right) => left.due_on.localeCompare(right.due_on))[0]

      if (oldestOverdueLoan) {
        throw loanCreationError(
          409,
          'STUDENT_HAS_OVERDUE_LOAN',
          `연체 중인 도서가 있어 대여할 수 없습니다. 가장 오래된 반납 예정일: ${oldestOverdueLoan.due_on}`
        )
      }

      if (activeLoans.some((loan) => loan.book_id === bookId)) {
        throw loanCreationError(409, 'ALREADY_RENTED', '이미 대여 중인 도서입니다.')
      }

      const { borrowerLabel, borrowerType, loanLimit } = getBorrowerLoanLimit(student)
      const activeLoanCount = activeLoans.length

      if (activeLoanCount >= loanLimit) {
        throw loanCreationError(
          409,
          'LOAN_LIMIT_EXCEEDED',
          `${borrowerLabel}은 최대 ${loanLimit}권까지 대여할 수 있습니다. 현재 ${activeLoanCount}권 대여 중입니다.`
        )
      }

      const dueOn = addDaysToDateKey(today, 14)
      const loan = await loanRepository.insertLoanForCreation(transaction, {
        book_id: bookId,
        borrowed_on: today,
        due_on: dueOn,
        notes: notes?.trim() || null,
        school_book_code: selectedSchoolBookCode,
        student_id: studentId,
      })
      const nextActiveLoanCount = activeLoanCount + 1

      return {
        activeLoanCount: nextActiveLoanCount,
        bookTitle: book.title,
        borrowerLabel,
        borrowerType,
        dueOn,
        loanId: loan.id,
        loanLimit,
        remainingLoanCount: Math.max(loanLimit - nextActiveLoanCount, 0),
        studentName: student.name,
      }
    })
  } catch (error) {
    throw mapLoanCreationDatabaseError(error)
  }
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
