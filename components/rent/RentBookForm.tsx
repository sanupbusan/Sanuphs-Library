'use client'

import { type CompositionEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, ScanBarcode, UserCheck } from 'lucide-react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { getBorrowerLookupCodeFromScannedValue, normalizeBorrowerLookupCode } from '@/lib/loan-limits'

type Student = {
  active_loan_count: number
  borrower_label: string
  borrower_type: 'staff' | 'student'
  class_number: number
  grade: number
  id: string
<<<<<<< HEAD
  loan_ban_remaining_days: number
  loan_banned_until: string | null
  loan_limit: number
  name: string
  overdue_days: number
=======
  loan_limit: number
  name: string
>>>>>>> origin/main
  remaining_loan_count: number
  seat_number: number
  student_number: string
}

type Book = {
  author: string
  available_copies: number
  id: string
  isbn: string | null
  publisher: string | null
  school_book_code: string | null
  title: string
  total_copies: number
}

type ApiResponse<T> = {
  data?: T
  error?: {
    code: string
    message: string
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

function normalizeRentCode(value: string) {
  return normalizeBarcodeInput(value).toUpperCase()
}

<<<<<<< HEAD
function getStudentRestrictionMessage(targetStudent: Student | null) {
  if (!targetStudent) {
    return ''
  }

  if (targetStudent.overdue_days > 0) {
    return `연체된 학생입니다. ${targetStudent.overdue_days}일`
  }

  if (targetStudent.loan_ban_remaining_days > 0) {
    return `대출 금지 기간입니다. ${targetStudent.loan_ban_remaining_days}일`
  }

  return ''
}

=======
>>>>>>> origin/main
export default function RentBookForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentInputRef = useRef<HTMLInputElement>(null)
  const bookInputRef = useRef<HTMLInputElement>(null)
  const isStudentInputComposingRef = useRef(false)
  const isBookInputComposingRef = useRef(false)
  const lastParamStudentNumberRef = useRef('')
  const paramStudentNumber = normalizeBorrowerLookupCode(normalizeRentCode(searchParams.get('studentNumber') ?? ''))

  const [studentNumber, setStudentNumber] = useState('')
  const [student, setStudent] = useState<Student | null>(null)
  const [bookCode, setBookCode] = useState('')
  const [book, setBook] = useState<Book | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [isLoadingBook, setIsLoadingBook] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
<<<<<<< HEAD
  const studentRestrictionMessage = getStudentRestrictionMessage(student)
=======
>>>>>>> origin/main

  function getBorrowerDisplay(targetStudent: Student) {
    if (targetStudent.borrower_type === 'staff') {
      return `${targetStudent.borrower_label} ${targetStudent.seat_number}번`
    }

    return `${targetStudent.grade}-${targetStudent.class_number}반 ${targetStudent.seat_number}번`
  }

  function focusBookInput() {
    window.setTimeout(() => {
      const input = bookInputRef.current
      input?.focus()
      input?.select()
    }, 0)
  }

  function focusStudentInput() {
    window.setTimeout(() => {
      const input = studentInputRef.current
      input?.focus()
      input?.select()
    }, 0)
  }

  function clearStudentSelection() {
    setStudent(null)
    setStudentNumber('')
    setBook(null)
    setBookCode('')
    setErrorMessage('')
    setSuccessMessage('')
    focusStudentInput()
  }

  function isComposingKeyEvent(event: KeyboardEvent<HTMLInputElement>) {
    return event.nativeEvent.isComposing || event.key === 'Process'
  }

  function handleStudentCodeChange(value: string) {
    setStudentNumber(isStudentInputComposingRef.current ? value : normalizeRentCode(value))
  }

  function handleBookCodeChange(value: string) {
    setBookCode(isBookInputComposingRef.current ? value : normalizeRentCode(value))
  }

  function handleStudentCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    isStudentInputComposingRef.current = false
    setStudentNumber(normalizeRentCode(event.currentTarget.value))
  }

  function handleBookCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    isBookInputComposingRef.current = false
    setBookCode(normalizeRentCode(event.currentTarget.value))
  }

  useEffect(() => {
    if (paramStudentNumber && lastParamStudentNumberRef.current !== paramStudentNumber) {
      lastParamStudentNumberRef.current = paramStudentNumber
      setStudentNumber(paramStudentNumber)
      void lookupStudent(paramStudentNumber)
    }
  }, [paramStudentNumber])

  useEffect(() => {
    if (student) {
      focusBookInput()
    }
  }, [student])

  async function lookupStudent(number = studentNumber, options: { clearCurrentStudent?: boolean } = {}) {
    const trimmed = normalizeBorrowerLookupCode(normalizeRentCode(number))
    if (!trimmed) {
      setErrorMessage('학번을 입력해주세요.')
      return
    }

    setIsLoadingStudent(true)
    setErrorMessage('')
    setSuccessMessage('')
    setBook(null)
    setBookCode('')
    if (options.clearCurrentStudent) {
      setStudent(null)
    }

    try {
      const response = await fetch(`/api/students?studentNumber=${encodeURIComponent(trimmed)}`)
      const payload = await readJsonResponse<ApiResponse<Student>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '학생 정보 조회에 실패했습니다.')
      }

      if (payload.data) {
        setStudentNumber(payload.data.student_number)
        setStudent(payload.data)
        focusBookInput()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '학생 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingStudent(false)
    }
  }

  async function lookupBook(code = bookCode) {
    const trimmed = normalizeRentCode(code)
    if (!trimmed) {
      setErrorMessage('도서 코드를 입력해주세요.')
      return
    }

    const borrowerCode = getBorrowerLookupCodeFromScannedValue(trimmed)
    if (borrowerCode) {
      setStudentNumber(borrowerCode)
      setBookCode('')
      setBook(null)
      await lookupStudent(borrowerCode, { clearCurrentStudent: true })
      return
    }

    setIsLoadingBook(true)
    setErrorMessage('')
    setSuccessMessage('')
    setBook(null)

    try {
      const response = await fetch(`/api/books/lookup?code=${encodeURIComponent(trimmed)}`)
      const payload = await readJsonResponse<ApiResponse<Book>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '도서 정보 조회에 실패했습니다.')
      }

      if (payload.data) {
        setBook(payload.data)

        if (payload.data.available_copies > 0) {
          await handleRent(payload.data)
        } else {
          setErrorMessage('이미 대여 중인 도서입니다.')
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '도서 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingBook(false)
    }
  }

  async function handleRent(targetBook = book) {
    if (!student || !targetBook) {
      setErrorMessage('학생과 도서를 모두 확인해주세요.')
      return
    }

<<<<<<< HEAD
    const restrictionMessage = getStudentRestrictionMessage(student)
    if (restrictionMessage) {
      setErrorMessage(restrictionMessage)
      return
    }

=======
>>>>>>> origin/main
    if (targetBook.available_copies <= 0) {
      setErrorMessage('이미 대여 중인 도서입니다.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/loans', {
        body: JSON.stringify({
          bookId: targetBook.id,
          studentId: student.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = await readJsonResponse<ApiResponse<{
        activeLoanCount: number
        bookTitle: string
        borrowerLabel: string
        borrowerType: 'staff' | 'student'
        dueOn: string
        loanId: string
        loanLimit: number
        remainingLoanCount: number
        studentName: string
      }>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '대여 처리에 실패했습니다.')
      }

      if (payload.data) {
        const loanResult = payload.data
        setSuccessMessage(
          `${loanResult.studentName} ${loanResult.borrowerLabel}이 "${loanResult.bookTitle}" 도서를 대여했습니다. (반납 예정일: ${loanResult.dueOn})`
        )
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
        setBook(null)
        setBookCode('')
        focusBookInput()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대여 처리에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleStudentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    if (isComposingKeyEvent(event)) return
    event.preventDefault()
    if (student) {
      focusBookInput()
      return
    }
    void lookupStudent()
  }

  function handleBookKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && isComposingKeyEvent(event)) {
      event.preventDefault()
    }
  }

  function handleStudentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isStudentInputComposingRef.current) {
      return
    }
    if (student) {
      focusBookInput()
      return
    }
    void lookupStudent()
  }

  function handleBookSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBookInputComposingRef.current) {
      return
    }
    void lookupBook()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서 대여</h1>
          <p className="mt-1 text-sm text-gray-600">학생 바코드를 스캔한 뒤, 대여할 도서를 스캔합니다.</p>
        </div>
      </div>

      <form onSubmit={handleStudentSubmit} className="mb-4 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <label htmlFor="student-number" className="mb-2 block text-sm font-medium text-gray-700">
          학생 바코드 (학번)
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="student-number"
              ref={studentInputRef}
              value={studentNumber}
              onChange={(event) => handleStudentCodeChange(event.target.value)}
              onCompositionEnd={handleStudentCompositionEnd}
              onCompositionStart={() => {
                isStudentInputComposingRef.current = true
              }}
              onFocus={() => {
                if (student) {
                  focusBookInput()
                }
              }}
              onKeyDown={handleStudentKeyDown}
              className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="학생/교직원 바코드 스캔"
              readOnly={Boolean(student)}
              type="text"
            />
          </div>
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
            disabled={isLoadingStudent || Boolean(student)}
            type="submit"
          >
            {isLoadingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            <span className="ml-2">확인</span>
          </button>
        </div>

        {student ? (
          <div className="mt-4 rounded-lg bg-green-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                <UserCheck className="h-4 w-4" />
                {student.name} ({getBorrowerDisplay(student)})
              </div>
              <button
                className="rounded-md px-2 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
                onClick={clearStudentSelection}
                type="button"
              >
                변경
              </button>
            </div>
            <p className="mt-1 text-xs text-green-600">
              코드: {student.student_number} · 대여: {student.active_loan_count}/{student.loan_limit}권 · 남은 가능 권수:{' '}
              {student.remaining_loan_count}권
            </p>
<<<<<<< HEAD
            {studentRestrictionMessage ? (
              <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {studentRestrictionMessage}
              </div>
            ) : null}
=======
>>>>>>> origin/main
          </div>
        ) : null}
      </form>

<<<<<<< HEAD
      {student && !studentRestrictionMessage ? (
=======
      {student ? (
>>>>>>> origin/main
        <form onSubmit={handleBookSubmit} className="mb-4 rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <label htmlFor="book-code" className="mb-2 block text-sm font-medium text-gray-700">
            도서 바코드 (ISBN 또는 학교 도서 코드)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="book-code"
                ref={bookInputRef}
                value={bookCode}
                onChange={(event) => handleBookCodeChange(event.target.value)}
                onCompositionEnd={handleBookCompositionEnd}
                onCompositionStart={() => {
                  isBookInputComposingRef.current = true
                }}
                onKeyDown={handleBookKeyDown}
                className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                placeholder="도서 바코드 스캔"
                type="text"
              />
            </div>
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
              disabled={isLoadingBook}
              type="submit"
            >
              {isLoadingBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              <span className="ml-2">조회</span>
            </button>
          </div>

          {book ? (
            <div className="mt-4 rounded-lg border border-gray-100 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-900">{book.title}</div>
              <div className="text-xs text-gray-500">
                저자: {book.author} | 출판사: {book.publisher ?? '-'} | 남은 권수: {book.available_copies}/{book.total_copies}
              </div>
              {isSubmitting ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-primary-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  대여 처리 중...
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}
    </div>
  )
}
