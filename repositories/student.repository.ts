import { sql } from 'drizzle-orm'
import type { DbClient } from '@/lib/db'
import type { LoanStudent } from '@/types/library'

export async function lookupStudentForLoan(db: DbClient, studentNumber: string): Promise<LoanStudent[]> {
  const result = await db.execute<LoanStudent>(
    sql`select * from public.lookup_student_for_loan(${studentNumber}::text)`
  )
  return result.rows
}
