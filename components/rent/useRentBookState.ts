'use client'

import { useState } from 'react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import type { RentBook, RentLoanResult, RentStudent } from '@/components/rent/rentBookApi'

export function normalizeRentCode(value: string) {
  return normalizeBarcodeInput(value).toUpperCase()
}

export function useRentBookState() {
  const [studentNumber, setStudentNumber] = useState('')
  const [student, setStudent] = useState<RentStudent | null>(null)
  const [bookCode, setBookCode] = useState('')
  const [book, setBook] = useState<RentBook | null>(null)

  function clearStudentSelection() {
    setStudent(null)
    setStudentNumber('')
    setBook(null)
    setBookCode('')
  }

  function clearBookSelection() {
    setBook(null)
    setBookCode('')
  }

  function setStudentSelection(nextStudent: RentStudent) {
    setStudentNumber(nextStudent.student_number)
    setStudent(nextStudent)
  }

  function applyLoanResult(loanResult: RentLoanResult) {
    setStudent((current) =>
      current
        ? {
            ...current,
            active_loan_count: loanResult.activeLoanCount,
            borrower_label: loanResult.borrowerLabel,
            borrower_type: loanResult.borrowerType,
            loan_limit: loanResult.loanLimit,
            remaining_loan_count: loanResult.remainingLoanCount,
          }
        : current
    )
    clearBookSelection()
  }

  return {
    applyLoanResult,
    book,
    bookCode,
    clearBookSelection,
    clearStudentSelection,
    setBook,
    setBookCode,
    setStudent,
    setStudentNumber,
    setStudentSelection,
    student,
    studentNumber,
  }
}
