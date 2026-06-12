'use client'

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, ScanBarcode, UserCheck } from 'lucide-react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'

type Student = {
  class_number: number
  grade: number
  id: string
  name: string
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

export default function RentBookForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentInputRef = useRef<HTMLInputElement>(null)
  const bookInputRef = useRef<HTMLInputElement>(null)

  const [studentNumber, setStudentNumber] = useState('')
  const [student, setStudent] = useState<Student | null>(null)
  const [bookCode, setBookCode] = useState('')
  const [book, setBook] = useState<Book | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const [isLoadingBook, setIsLoadingBook] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const paramStudentNumber = searchParams.get('studentNumber') ?? ''
    if (paramStudentNumber) {
      setStudentNumber(paramStudentNumber)
      void lookupStudent(paramStudentNumber)
    }
  }, [searchParams])

  useEffect(() => {
    if (student && bookInputRef.current) {
      bookInputRef.current.focus()
    }
  }, [student])

  async function lookupStudent(number = studentNumber) {
    const trimmed = number.trim()
    if (!trimmed) {
      setErrorMessage('학번을 입력해주세요.')
      return
    }

    setIsLoadingStudent(true)
    setErrorMessage('')
    setSuccessMessage('')
    setStudent(null)
    setBook(null)

    try {
      const response = await fetch(`/api/students?studentNumber=${encodeURIComponent(trimmed)}`)
      const payload = await readJsonResponse<ApiResponse<Student>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '학생 정보 조회에 실패했습니다.')
      }

      if (payload.data) {
        setStudent(payload.data)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '학생 정보 조회에 실패했습니다.')
    } finally {
      setIsLoadingStudent(false)
    }
  }

  async function lookupBook(code = bookCode) {
    const trimmed = normalizeBarcodeInput(code)
    if (!trimmed) {
      setErrorMessage('도서 코드를 입력해주세요.')
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
      const payload = await readJsonResponse<ApiResponse<{ bookTitle: string; dueOn: string; loanId: string; studentName: string }>>(response)

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '대여 처리에 실패했습니다.')
      }

      if (payload.data) {
        setSuccessMessage(
          `${payload.data.studentName} 학생이 "${payload.data.bookTitle}" 도서를 대여했습니다. (반납 예정일: ${payload.data.dueOn})`
        )
        setBook(null)
        setBookCode('')
        setTimeout(() => {
          bookInputRef.current?.focus()
        }, 0)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대여 처리에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleStudentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void lookupStudent()
  }

  function handleStudentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void lookupStudent()
  }

  function handleBookSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
              onChange={(event) => setStudentNumber(event.target.value)}
              onKeyDown={handleStudentKeyDown}
              className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              inputMode="numeric"
              placeholder="학생 바코드 스캔"
              type="text"
            />
          </div>
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
            disabled={isLoadingStudent}
            type="submit"
          >
            {isLoadingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            <span className="ml-2">확인</span>
          </button>
        </div>

        {student ? (
          <div className="mt-4 rounded-lg bg-green-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <UserCheck className="h-4 w-4" />
              {student.name} ({student.grade}-{student.class_number}반 {student.seat_number}번)
            </div>
            <p className="mt-1 text-xs text-green-600">학번: {student.student_number}</p>
          </div>
        ) : null}
      </form>

      {student ? (
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
                onChange={(event) => setBookCode(normalizeBarcodeInput(event.target.value))}
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
