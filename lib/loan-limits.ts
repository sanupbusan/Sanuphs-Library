export type BorrowerType = 'staff' | 'student'

export const STUDENT_ACTIVE_LOAN_LIMIT = 2
export const STAFF_ACTIVE_LOAN_LIMIT = 5

export function normalizeBorrowerLookupCode(value: string) {
  const code = value.trim().toUpperCase()

  if (/^\d{2}$/.test(code)) {
    return `T${code}`
  }

  return code
}

export function getBorrowerLookupCodeFromScannedValue(value: string) {
  const code = value.trim().toUpperCase()

  if (/^\d{5}$/.test(code) || /^\d{2}$/.test(code) || /^T\d{2}$/.test(code)) {
    return normalizeBorrowerLookupCode(code)
  }

  return null
}

type BorrowerIdentity = {
  class_number?: number | null
  student_number: string
}

export function getBorrowerType(borrower: BorrowerIdentity): BorrowerType {
  const studentNumber = borrower.student_number.trim()

  if (/^T\d{2}$/i.test(studentNumber) || borrower.class_number === 99) {
    return 'staff'
  }

  return 'student'
}

export function getBorrowerLabel(type: BorrowerType) {
  return type === 'staff' ? '교직원' : '학생'
}

export function getActiveLoanLimit(type: BorrowerType) {
  return type === 'staff' ? STAFF_ACTIVE_LOAN_LIMIT : STUDENT_ACTIVE_LOAN_LIMIT
}

export function getBorrowerLoanLimit(borrower: BorrowerIdentity) {
  const borrowerType = getBorrowerType(borrower)

  return {
    borrowerLabel: getBorrowerLabel(borrowerType),
    borrowerType,
    loanLimit: getActiveLoanLimit(borrowerType),
  }
}
