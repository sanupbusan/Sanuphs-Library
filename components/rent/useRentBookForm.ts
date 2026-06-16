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
import {
  createRentLoan,
  lookupRentBook,
  lookupRentStudent,
  type RentBook,
  type RentStudent,
} from '@/components/rent/rentBookApi'
import { normalizeRentCode, useRentBookState } from '@/components/rent/useRentBookState'
import { useInputFocus } from '@/hooks/useInputFocus'
import { useStatusMessages } from '@/hooks/useStatusMessages'
import { getBorrowerLookupCodeFromScannedValue, normalizeBorrowerLookupCode } from '@/lib/loan-limits'

export function useRentBookForm() {
  const searchParams = useSearchParams()
  const {
    applyLoanResult,
    book,
    bookCode,
    clearBookSelection,
    clearStudentSelection: clearRentState,
    setBook,
    setBookCode,
    setStudent,
    setStudentNumber,
    setStudentSelection,
    student,
    studentNumber,
  } = useRentBookState()
  const {
    clearMessages,
    errorMessage,
    setErrorMessage,
    setSuccessMessage,
    successMessage,
  } = useStatusMessages()
  const { focusInput: focusStudentInput, inputRef: studentInputRef } = useInputFocus<HTMLInputElement>()
  const { focusInput: focusBookInput, inputRef: bookInputRef } = useInputFocus<HTMLInputElement>()
  const isStudentInputComposingRef = useRef(false)
  const isBookInputComposingRef = useRef(false)
  const lastParamStudentNumberRef = useRef('')
  const paramStudentNumber = normalizeBorrowerLookupCode(normalizeRentCode(searchParams.get('studentNumber') ?? ''))
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [isLoadingBook, setIsLoadingBook] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function getBorrowerDisplay(targetStudent: RentStudent) {
    if (targetStudent.borrower_type === 'staff') {
      return `${targetStudent.borrower_label} ${targetStudent.seat_number}번`
    }

    return `${targetStudent.grade}-${targetStudent.class_number}반 ${targetStudent.seat_number}번`
  }

  function focusBookField() {
    focusBookInput({ select: true })
  }

  function focusStudentField() {
    focusStudentInput({ select: true })
  }

  function clearStudentSelection() {
    clearRentState()
    clearMessages()
    focusStudentField()
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
    clearMessages()
    clearBookSelection()

    if (options.clearCurrentStudent) {
      setStudent(null)
    }

    try {
      const nextStudent = await lookupRentStudent(trimmed)

      setStudentSelection(nextStudent)
      focusBookField()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '학생 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingStudent(false)
    }
  }

  async function handleRent(targetBook: RentBook | null = book) {
    if (!student || !targetBook) {
      setErrorMessage('학생과 도서를 모두 확인해주세요.')
      return
    }

    if (targetBook.available_copies <= 0) {
      setErrorMessage('이미 대여 중인 도서입니다.')
      return
    }

    setIsSubmitting(true)
    clearMessages()

    try {
      const loanResult = await createRentLoan(targetBook.id, student.id)

      setSuccessMessage(
        `${loanResult.studentName} ${loanResult.borrowerLabel}이 "${loanResult.bookTitle}" 도서를 대여했습니다. (반납 예정일: ${loanResult.dueOn})`
      )
      applyLoanResult(loanResult)
      focusBookField()
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
      clearBookSelection()
      await lookupStudent(borrowerCode, { clearCurrentStudent: true })
      return
    }

    setIsLoadingBook(true)
    clearMessages()
    setBook(null)

    try {
      const nextBook = await lookupRentBook(trimmed)

      setBook(nextBook)

      if (nextBook.available_copies > 0) {
        await handleRent(nextBook)
      } else {
        setErrorMessage('이미 대여 중인 도서입니다.')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '도서 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingBook(false)
    }
  }

  function handleStudentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || isComposingKeyEvent(event)) {
      return
    }

    event.preventDefault()

    if (student) {
      focusBookField()
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
      focusBookField()
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
      focusBookField()
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
