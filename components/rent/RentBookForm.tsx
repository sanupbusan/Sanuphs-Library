'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, UserCheck } from 'lucide-react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import {
  getBorrowerLookupCodeFromScannedValue,
  normalizeBorrowerLookupCode,
} from '@/lib/loan-limits'
import { WorkflowStepCard } from '@/components/ui/WorkflowStepCard'
import { ScanInput } from '@/components/ui/ScanInput'
import { StatusMessage } from '@/components/ui/StatusMessage'
import type { Database } from '@/types/supabase'

type LoanStudent = Database['public']['Functions']['lookup_student_for_loan']['Returns'][number]

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

type Status = {
  message: string
  variant: 'error' | 'success' | 'info' | 'warning'
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

function getBorrowerDisplay(targetStudent: LoanStudent) {
  if (targetStudent.borrower_type === 'staff') {
    return `${targetStudent.borrower_label} ${targetStudent.seat_number}번`
  }

  return `${targetStudent.grade}-${targetStudent.class_number}반 ${targetStudent.seat_number}번`
}

function getStudentRestrictionMessage(targetStudent: LoanStudent | null): string | null {
  if (!targetStudent) {
    return null
  }

  if (targetStudent.overdue_days > 0) {
    return `반납 예정일이 지난 도서가 있습니다. 먼저 연체 도서를 반납해주세요.`
  }

  if (targetStudent.loan_ban_remaining_days > 0 && targetStudent.loan_banned_until) {
    return `연체로 인한 대출 금지 기간입니다. ${formatKoreanDate(targetStudent.loan_banned_until)}까지 대여할 수 없습니다.`
  }

  return null
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`
}

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
  const [student, setStudent] = useState<LoanStudent | null>(null)
  const [bookCode, setBookCode] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [isLoadingBook, setIsLoadingBook] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const restrictionMessage = getStudentRestrictionMessage(student)
  const isStudentEligible = student !== null && restrictionMessage === null

  function focusStudentInput() {
    window.setTimeout(() => {
      const input = studentInputRef.current
      input?.focus()
      input?.select()
    }, 0)
  }

  function focusBookInput() {
    window.setTimeout(() => {
      const input = bookInputRef.current
      input?.focus()
      input?.select()
    }, 0)
  }

  function clearStudentSelection() {
    setStudent(null)
    setStudentNumber('')
    setBookCode('')
    setStatus(null)
    focusStudentInput()
  }

  function setError(message: string) {
    setStatus({ message, variant: 'error' })
  }

  function setSuccess(message: string) {
    setStatus({ message, variant: 'success' })
  }

  function setInfo(message: string) {
    setStatus({ message, variant: 'info' })
  }

  useEffect(() => {
    if (paramStudentNumber && lastParamStudentNumberRef.current !== paramStudentNumber) {
      lastParamStudentNumberRef.current = paramStudentNumber
      setStudentNumber(paramStudentNumber)
      void lookupStudent(paramStudentNumber)
    }
  }, [paramStudentNumber])

  useEffect(() => {
    if (isStudentEligible) {
      focusBookInput()
    }
  }, [isStudentEligible])

  async function lookupStudent(number = studentNumber) {
    const trimmed = normalizeBorrowerLookupCode(normalizeRentCode(number))
    if (!trimmed) {
      setError('학번을 입력해주세요.')
      return
    }

    setIsLoadingStudent(true)
    setStatus(null)
    setStudent(null)
    setBookCode('')

    try {
      const response = await fetch(`/api/students?studentNumber=${encodeURIComponent(trimmed)}`)
      const payload = await readJsonResponse<ApiResponse<LoanStudent>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '학생 정보 조회에 실패했습니다.')
      }

      if (payload.data) {
        setStudentNumber(payload.data.student_number)
        setStudent(payload.data)

        const restriction = getStudentRestrictionMessage(payload.data)
        if (restriction) {
          setError(restriction)
        } else {
          setInfo(`${payload.data.name} ${getBorrowerDisplay(payload.data)} 확인되었습니다. 도서 바코드를 스캔하세요.`)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '학생 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingStudent(false)
    }
  }

  async function lookupBook(code = bookCode) {
    const trimmed = normalizeRentCode(code)
    if (!trimmed) {
      setError('도서 코드를 입력해주세요.')
      return
    }

    const borrowerCode = getBorrowerLookupCodeFromScannedValue(trimmed)
    if (borrowerCode) {
      clearStudentSelection()
      setStudentNumber(borrowerCode)
      await lookupStudent(borrowerCode)
      return
    }

    if (!isStudentEligible) {
      setError('학생 확인 후 도서를 스캔하세요.')
      return
    }

    setIsLoadingBook(true)
    setStatus(null)

    try {
      const response = await fetch(`/api/books/lookup?code=${encodeURIComponent(trimmed)}`)
      const payload = await readJsonResponse<ApiResponse<Book>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '도서 정보 조회에 실패했습니다.')
      }

      if (payload.data) {
        if (payload.data.available_copies <= 0) {
          setError('이미 대여 중인 도서입니다.')
          return
        }

        await handleRent(payload.data)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '도서 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingBook(false)
    }
  }

  async function handleRent(targetBook: Book) {
    if (!student) {
      setError('학생 정보를 먼저 확인해주세요.')
      return
    }

    setIsSubmitting(true)
    setStatus(null)

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
      const payload = await readJsonResponse<
        ApiResponse<{
          activeLoanCount: number
          bookTitle: string
          borrowerLabel: string
          borrowerType: 'staff' | 'student'
          dueOn: string
          loanId: string
          loanLimit: number
          remainingLoanCount: number
          studentName: string
        }>
      >(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '대여 처리에 실패했습니다.')
      }

      if (payload.data) {
        const loanResult = payload.data
        setSuccess(
          `${loanResult.studentName} ${loanResult.borrowerLabel}이 "${loanResult.bookTitle}" 도서를 대여했습니다. 반납 예정일: ${formatKoreanDate(
            loanResult.dueOn
          )}. 다음 도서를 스캔하세요.`
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
        setBookCode('')
        focusBookInput()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '대여 처리에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleStudentEnter() {
    if (student) {
      focusBookInput()
      return
    }
    void lookupStudent()
  }

  function handleBookEnter() {
    void lookupBook()
  }

  function handleStudentCompositionEnd(value: string) {
    isStudentInputComposingRef.current = false
    setStudentNumber(normalizeRentCode(value))
  }

  function handleBookCompositionEnd(value: string) {
    isBookInputComposingRef.current = false
    setBookCode(normalizeRentCode(value))
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

      <div className="space-y-4">
        <WorkflowStepCard
          step={1}
          state={student ? 'complete' : 'current'}
          title="학생 확인"
          description="학생 또는 교직원 바코드를 스캔하세요."
          action={
            student ? (
              <button
                className="rounded-md px-2 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
                onClick={clearStudentSelection}
                type="button"
              >
                변경
              </button>
            ) : null
          }
        >
          <div className="space-y-3">
            <ScanInput
              ref={studentInputRef}
              id="student-number"
              label="학생/교직원 바코드"
              placeholder="학생/교직원 바코드 스캔"
              value={studentNumber}
              onChangeValue={(value) =>
                setStudentNumber(isStudentInputComposingRef.current ? value : normalizeRentCode(value))
              }
              onCompositionStart={() => {
                isStudentInputComposingRef.current = true
              }}
              onCompositionEnd={handleStudentCompositionEnd}
              onEnter={handleStudentEnter}
              loading={isLoadingStudent}
              helperText={student ? 'Enter를 눌러 도서 단계로 이동하세요.' : '스캔 후 Enter를 누륨녀 자동으로 확인됩니다.'}
              disabled={Boolean(student)}
            />

            {student ? (
              <div className="rounded-lg bg-green-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <UserCheck className="h-4 w-4" />
                  {student.name} ({getBorrowerDisplay(student)})
                </div>
                <p className="mt-1 text-xs text-green-700">
                  코드: {student.student_number} · 대여: {student.active_loan_count}/{student.loan_limit}권 · 남은 가능 권수:{student.remaining_loan_count}권
                </p>
              </div>
            ) : null}
          </div>
        </WorkflowStepCard>

        <WorkflowStepCard
          step={2}
          state={!student ? 'locked' : isStudentEligible ? 'current' : 'error'}
          title="도서 스캔"
          description={
            !student
              ? '학생 확인 후 도서 바코드를 스캔하세요.'
              : isStudentEligible
                ? '대여할 도서 바코드를 스캔하세요.'
                : '현재 대여할 수 없는 상태입니다.'
          }
        >
          <div className="space-y-3">
            <ScanInput
              ref={bookInputRef}
              id="book-code"
              label="도서 바코드 (ISBN 또는 학교 도서 코드)"
              placeholder="도서 바코드 스캔"
              value={bookCode}
              onChangeValue={(value) => setBookCode(isBookInputComposingRef.current ? value : normalizeRentCode(value))}
              onCompositionStart={() => {
                isBookInputComposingRef.current = true
              }}
              onCompositionEnd={handleBookCompositionEnd}
              onEnter={handleBookEnter}
              loading={isLoadingBook || isSubmitting}
              helperText={isStudentEligible ? '스캔하면 자동으로 대여됩니다.' : '학생 확인 단계를 먼저 완료하세요.'}
              disabled={!isStudentEligible}
            />
          </div>
        </WorkflowStepCard>

        {status ? (
          <StatusMessage variant={status.variant}>{status.message}</StatusMessage>
        ) : null}
      </div>
    </div>
  )
}
