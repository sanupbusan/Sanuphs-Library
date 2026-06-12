'use client'

import {
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { readJsonResponse } from '@/lib/api-client'
import { getBorrowerLookupCodeFromScannedValue, normalizeBorrowerLookupCode } from '@/lib/loan-limits'
import type {
  ApiResponse,
  BookLookupResult,
  LoanCreationResult,
  LoanStudent,
} from '@/types/library'

type Student = LoanStudent
type Book = BookLookupResult
type LoanResult = LoanCreationResult

function normalizeRentCode(value: string) {
  return normalizeBarcodeInput(value).toUpperCase()
}

export function useRentBookForm() {
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

  async function handleRent(targetBook = book) {
    if (!student || !targetBook) {
      setErrorMessage('학생과 도서를 모두 확인해주세요.')
      return
    }

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
      const payload = await readJsonResponse<ApiResponse<LoanResult>>(response)

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

  function handleStudentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    if (isComposingKeyEvent(event)) {
      return
    }

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

  return {
    book,
    bookCode,
    bookInputRef,
    clearStudentSelection,
    errorMessage,
    getBorrowerDisplay,
    handleBookCodeChange,
    handleBookCompositionEnd,
    handleBookKeyDown,
    handleBookSubmit,
    handleStudentCodeChange,
    handleStudentCompositionEnd,
    handleStudentKeyDown,
    handleStudentSubmit,
    isBookInputComposingRef,
    isLoadingBook,
    isLoadingStudent,
    isSubmitting,
    isStudentInputComposingRef,
    student,
    studentInputRef,
    studentNumber,
    successMessage,
  }
}
