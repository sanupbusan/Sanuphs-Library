'use client'

import { BookOpen, Loader2, ScanBarcode, UserCheck } from 'lucide-react'
import { useRentBookForm } from '@/components/rent/useRentBookForm'

export default function RentBookForm() {
  const {
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
  } = useRentBookForm()

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
                  bookInputRef.current?.focus()
                }
              }}
              onKeyDown={handleStudentKeyDown}
          </div>

          {book ? (
            <div className="mt-4 rounded-lg border border-gray-100 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-900">{book.title}</div>
              <div className="text-xs text-gray-500">
                저자: {book.author ?? '-'} | 출판사: {book.publisher ?? '-'} | 남은 권수: {book.available_copies}/{book.total_copies}
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
