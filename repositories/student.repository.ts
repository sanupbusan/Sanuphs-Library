import { sql } from 'drizzle-orm'
import type { DbClient } from '@/lib/db'
import type { BorrowerBarcodeRow, LoanStudent } from '@/types/library'

export async function lookupStudentForLoan(db: DbClient, studentNumber: string): Promise<LoanStudent[]> {
  const result = await db.execute<LoanStudent>(
    sql`select * from public.lookup_student_for_loan(${studentNumber}::text)`
  )
  return result.rows
}

export async function listBorrowersForBarcodePrint(db: DbClient): Promise<BorrowerBarcodeRow[]> {
  const result = await db.execute<BorrowerBarcodeRow>(
    sql`select * from public.list_borrowers_for_barcode_print()`
  )
  return result.rows
}
