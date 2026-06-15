import { ApiRouteError } from '@/lib/api-route'
import type { TypedSupabaseClient } from '@/lib/supabase'
import type { LoanStatus, LoanWithBookAndStudent } from '@/types/library'

const ADMIN_LOAN_COLUMNS =
  'id, book_id, student_id, borrowed_on, due_on, returned_on, status, books(title, school_book_code), students(name, student_number)'

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

export async function listAdminLoans(supabase: TypedSupabaseClient): Promise<LoanWithBookAndStudent[]> {
  const { data, error } = await supabase
    .from('loans')
    .select(ADMIN_LOAN_COLUMNS)
    .eq('status', 'rented')
    .order('borrowed_on', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as LoanWithBookAndStudent[]
}

export async function updateAdminLoan(
  supabase: TypedSupabaseClient,
  loanId: string,
  input: UpdateAdminLoanInput
): Promise<LoanWithBookAndStudent> {
  if (!loanId) {
    throw new ApiRouteError(400, 'MISSING_LOAN_ID', '대여 ID가 필요합니다.')
  }

  const { data: existingLoan, error: existingLoanError } = await supabase
    .from('loans')
    .select('id, borrowed_on, due_on')
    .eq('id', loanId)
    .maybeSingle()

  if (existingLoanError) {
    throw existingLoanError
  }

  if (!existingLoan) {
    throw new ApiRouteError(404, 'LOAN_NOT_FOUND', '대여 정보를 찾을 수 없습니다.')
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
    throw new ApiRouteError(400, 'INVALID_STATUS', '대여 상태 값이 올바르지 않습니다.')
  }

  if (borrowedOnText) {
    if (!isDateString(borrowedOnText)) {
      throw new ApiRouteError(400, 'INVALID_BORROWED_ON', '대여일 형식이 올바르지 않습니다.')
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
      throw new ApiRouteError(400, 'DUE_ON_BEFORE_BORROWED_ON', '반납 예정일은 대여일보다 빠를 수 없습니다.')
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiRouteError(400, 'NO_UPDATES', '변경할 내용이 없습니다.')
  }

  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', loanId)
    .select(ADMIN_LOAN_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === '23514') {
      throw new ApiRouteError(400, 'LOAN_CONSTRAINT_VIOLATION', '대여일과 반납 예정일 값이 올바르지 않습니다.')
    }

    throw error
  }

  if (!data) {
    throw new ApiRouteError(404, 'LOAN_NOT_FOUND', '대여 정보를 찾을 수 없습니다.')
  }

  return data as unknown as LoanWithBookAndStudent
}
