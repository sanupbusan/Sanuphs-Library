import type { DbClient } from '@/lib/db'
import type { BorrowerBarcodeRow, LoanStudent } from '@/types/library'
import * as studentRepository from '@/repositories/student.repository'

export async function lookupStudentForLoan(db: DbClient, studentNumber: string): Promise<LoanStudent | null> {
  const rows = await studentRepository.lookupStudentForLoan(db, studentNumber)
  return rows[0] ?? null
}

export function listBorrowersForBarcodePrint(db: DbClient): Promise<BorrowerBarcodeRow[]> {
  return studentRepository.listBorrowersForBarcodePrint(db)
}
