import { asc, eq, lt, sql } from 'drizzle-orm'
import { books, loans, students } from '@/db/schema'
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

const loanWithRelationsSelect = {
  id: loans.id,
  book_id: loans.book_id,
  student_id: loans.student_id,
  borrowed_on: loans.borrowed_on,
  due_on: loans.due_on,
  returned_on: loans.returned_on,
  status: loans.status,
  books: {
    title: books.title,
    school_book_code: books.school_book_code,
  },
  students: {
    name: students.name,
    student_number: students.student_number,
  },
}

type BackendActiveLoanRow = {
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

export async function listAdminLoans(db: DbClient): Promise<LoanWithBookAndStudent[]> {
  const result = await db.execute<BackendActiveLoanRow>(
    sql`select * from public.list_backend_active_loans()`
  )

  return result.rows.map((loan) => ({
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
  }))
}

export async function getAdminLoanById(db: DbClient, loanId: string): Promise<LoanWithBookAndStudent | null> {
  const rows = await db
    .select(loanWithRelationsSelect)
    .from(loans)
    .innerJoin(books, eq(books.id, loans.book_id))
    .innerJoin(students, eq(students.id, loans.student_id))
    .where(eq(loans.id, loanId))
    .limit(1)

  return rows[0] ?? null
}

export async function getExistingLoanDates(db: DbClient, loanId: string) {
  const rows = await db
    .select({ id: loans.id, borrowed_on: loans.borrowed_on, due_on: loans.due_on })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1)

  return rows[0] ?? null
}

export async function updateLoanFields(db: DbClient, loanId: string, updates: {
  borrowed_on?: string
  due_on?: string
  returned_on?: string | null
  status?: LoanStatus
}) {
  const rows = await db.update(loans).set(updates).where(eq(loans.id, loanId)).returning({ id: loans.id })
  return rows.length
}

export async function listAdminOverdueLoans(db: DbClient, today: string) {
  return db
    .select({
      id: loans.id,
      borrowedOn: loans.borrowed_on,
      dueOn: loans.due_on,
      bookTitle: books.title,
      studentName: students.name,
      studentNumber: students.student_number,
    })
    .from(loans)
    .leftJoin(books, eq(books.id, loans.book_id))
    .leftJoin(students, eq(students.id, loans.student_id))
    .where(sql`${loans.status} = 'rented' and ${loans.due_on} < ${today}`)
    .orderBy(asc(loans.due_on))
    .limit(100)
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
    sql`select * from public.create_public_loan(${bookId}::uuid, ${studentId}::uuid, ${notes}::text, ${schoolBookCode}::text)`
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
