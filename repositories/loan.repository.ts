import { asc, desc, eq, lt, sql } from 'drizzle-orm'
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

export async function listAdminLoans(db: DbClient): Promise<LoanWithBookAndStudent[]> {
  return db
    .select(loanWithRelationsSelect)
    .from(loans)
    .innerJoin(books, eq(books.id, loans.book_id))
    .innerJoin(students, eq(students.id, loans.student_id))
    .where(eq(loans.status, 'rented'))
    .orderBy(desc(loans.borrowed_on))
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
  return db
    .select({
      id: loans.id,
      due_on: loans.due_on,
      student_name: sql<string>`coalesce(${students.name}, '-')`,
    })
    .from(loans)
    .leftJoin(students, eq(students.id, loans.student_id))
    .where(sql`${loans.status} = 'rented' and ${loans.due_on} < current_date`)
    .orderBy(asc(loans.due_on))
    .limit(limit)
}

export async function getStudentLoanStats(db: DbClient): Promise<StudentLoanStat[]> {
  return db
    .select({
      student_id: loans.student_id,
      student_name: sql<string>`coalesce(${students.name}, '-')`,
      total_loans: sql<number>`count(${loans.id})::integer`,
    })
    .from(loans)
    .leftJoin(students, eq(students.id, loans.student_id))
    .groupBy(loans.student_id, students.name)
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
    sql`select * from public.return_loans_by_school_book_codes(${codes}::text[])`
  )
  return result.rows
}
