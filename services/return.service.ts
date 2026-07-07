import type { DbClient } from '@/lib/db'
import type { ReturnableLoan, ReturnedLoan } from '@/types/library'
import * as loanRepository from '@/repositories/loan.repository'

export async function getReturnableLoanBySchoolBookCode(
  db: DbClient,
  code: string
): Promise<ReturnableLoan | null> {
  const rows = await loanRepository.getReturnableLoanBySchoolBookCode(db, code)
  return rows[0] ?? null
}

export async function returnLoansBySchoolBookCodes(
  db: DbClient,
  schoolBookCodes: string[]
): Promise<ReturnedLoan[]> {
  return loanRepository.returnLoansBySchoolBookCodes(db, schoolBookCodes)
}

export const ReturnService = {
  getReturnableLoanBySchoolBookCode,
  processReturn: returnLoansBySchoolBookCodes,
}
