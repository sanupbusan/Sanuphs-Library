import type { DbClient } from '@/lib/db'
import type { CreatedPublicLoan } from '@/types/library'
import * as loanRepository from '@/repositories/loan.repository'

export async function createPublicLoan(
  db: DbClient,
  bookId: string,
  studentId: string,
  notes: string | null,
  schoolBookCode: string | null
): Promise<CreatedPublicLoan | null> {
  const rows = await loanRepository.createPublicLoanViaRpc(
    db,
    bookId,
    studentId,
    notes,
    schoolBookCode
  )
  return rows[0] ?? null
}
