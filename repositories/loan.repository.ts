import { sql } from 'drizzle-orm'
import type { DbClient } from '@/lib/db'
import type {
  CreatedPublicLoan,
  DashboardOverdueLoan,
  LoanStatus,
  LoanWithBookAndStudent,
  ReturnableLoan,
  ReturnedLoan,
  StudentLoanStat,
} from '@/types/library'

function textArraySql(values: string[]) {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`
}

type BackendLoanRow = {
  id: string
  book_id: string
  student_id: string
  borrowed_on: string
  due_on: string
  returned_on: string | null
  status: LoanStatus
  book_title: string | null
  book_school_book_code: string | null
  student_name: string | null
  student_number: string | null
}

type BackendAdminOverdueLoanRow = {
  id: string
  borrowed_on: string
  due_on: string
  book_title: string | null
  student_name: string | null
  student_number: string | null
}

function mapBackendLoanRow(loan: BackendLoanRow): LoanWithBookAndStudent {
  return {
    id: loan.id,
    book_id: loan.book_id,
    student_id: loan.student_id,
    borrowed_on: loan.borrowed_on,
    due_on: loan.due_on,
    returned_on: loan.returned_on,
    status: loan.status,
    books: loan.book_title === null && loan.book_school_book_code === null
      ? null
      : {
          title: loan.book_title ?? '-',
          school_book_code: loan.book_school_book_code,
        },
    students: loan.student_name === null && loan.student_number === null
      ? null
      : {
          name: loan.student_name ?? '-',
          student_number: loan.student_number ?? '-',
        },
  }
}

export async function listAdminLoans(db: DbClient): Promise<LoanWithBookAndStudent[]> {
  const result = await db.execute<BackendLoanRow>(
    sql`select * from public.list_backend_active_loans()`
  )

  return result.rows.map(mapBackendLoanRow)
}

export async function getAdminLoanById(db: DbClient, loanId: string): Promise<LoanWithBookAndStudent | null> {
  const result = await db.execute<BackendLoanRow>(
    sql`select * from public.get_backend_loan_by_id(${loanId}::uuid)`
  )
  const loan = result.rows[0]

  return loan ? mapBackendLoanRow(loan) : null
}

export async function getExistingLoanDates(db: DbClient, loanId: string) {
  const result = await db.execute<BackendLoanRow>(
    sql`select * from public.get_backend_loan_by_id(${loanId}::uuid)`
  )
  const loan = result.rows[0]

  return loan
    ? { id: loan.id, borrowed_on: loan.borrowed_on, due_on: loan.due_on }
    : null
}

export async function updateLoanFields(db: DbClient, loanId: string, updates: {
  borrowed_on?: string
  due_on?: string
  returned_on?: string | null
  status?: LoanStatus
}) {
  const hasBorrowedOn = Object.prototype.hasOwnProperty.call(updates, 'borrowed_on')
  const hasDueOn = Object.prototype.hasOwnProperty.call(updates, 'due_on')
  const hasReturnedOn = Object.prototype.hasOwnProperty.call(updates, 'returned_on')
  const hasStatus = Object.prototype.hasOwnProperty.call(updates, 'status')
  const result = await db.execute<{ loan_id: string }>(
    sql`select * from public.update_backend_loan_fields(
      ${loanId}::uuid,
      ${updates.borrowed_on ?? null}::date,
      ${updates.due_on ?? null}::date,
      ${updates.returned_on ?? null}::date,
      ${updates.status ?? null}::public.loan_status,
      ${hasBorrowedOn}::boolean,
      ${hasDueOn}::boolean,
      ${hasReturnedOn}::boolean,
      ${hasStatus}::boolean
    )`
  )

  return result.rows.length
}

export async function listAdminOverdueLoans(db: DbClient, today: string) {
  const result = await db.execute<BackendAdminOverdueLoanRow>(
    sql`select * from public.list_backend_admin_overdue_loans(${today}::date, 100::integer)`
  )

  return result.rows.map((loan) => ({
    id: loan.id,
    borrowedOn: loan.borrowed_on,
    dueOn: loan.due_on,
    bookTitle: loan.book_title,
    studentName: loan.student_name,
    studentNumber: loan.student_number,
  }))
}

export async function getDashboardOverdueLoans(db: DbClient, limit: number): Promise<DashboardOverdueLoan[]> {
  const result = await db.execute<DashboardOverdueLoan>(
    sql`select * from public.list_backend_dashboard_overdue_loans(${limit}::integer)`
  )

  return result.rows
}

export async function getStudentLoanStats(db: DbClient): Promise<StudentLoanStat[]> {
  const result = await db.execute<StudentLoanStat>(
    sql`select * from public.list_backend_student_loan_stats()`
  )

  return result.rows
}

export async function createPublicLoanViaRpc(
  db: DbClient,
  bookId: string,
  studentId: string,
  notes: string | null,
  schoolBookCode: string | null
): Promise<CreatedPublicLoan[]> {
  const result = await db.execute<CreatedPublicLoan>(
    sql`select * from public.create_public_loan(
      ${bookId}::uuid,
      ${studentId}::uuid,
      ${notes}::text,
      ${schoolBookCode}::text
    )`
  )

  return result.rows
}

export async function getReturnableLoanBySchoolBookCode(
  db: DbClient,
  code: string
): Promise<ReturnableLoan[]> {
  const result = await db.execute<ReturnableLoan>(
    sql`select * from public.get_returnable_loan_by_school_book_code(${code}::text)`
  )
  return result.rows
}

export async function returnLoansBySchoolBookCodes(
  db: DbClient,
  codes: string[]
): Promise<ReturnedLoan[]> {
  const result = await db.execute<ReturnedLoan>(
    sql`select * from public.return_loans_by_school_book_codes(${textArraySql(codes)})`
  )
  return result.rows
}
