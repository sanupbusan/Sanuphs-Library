import { readApiData } from '@/lib/api-client'
import type {
  BookLookupResult,
  LoanCreationResult,
  LoanStudent,
} from '@/types/library'

export type RentStudent = LoanStudent
export type RentBook = BookLookupResult
export type RentLoanResult = LoanCreationResult

export async function lookupRentStudent(studentNumber: string) {
  const response = await fetch(`/api/students?studentNumber=${encodeURIComponent(studentNumber)}`)

  return readApiData<RentStudent>(response, '학생 정보 조회에 실패했습니다.')
}

export async function lookupRentBook(code: string) {
  const response = await fetch(`/api/books/lookup?code=${encodeURIComponent(code)}`)

  return readApiData<RentBook>(response, '도서 정보 조회에 실패했습니다.')
}

export async function createRentLoan(bookId: string, studentId: string) {
  const response = await fetch('/api/loans', {
    body: JSON.stringify({
      bookId,
      studentId,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  return readApiData<RentLoanResult>(response, '대여 처리에 실패했습니다.')
}
