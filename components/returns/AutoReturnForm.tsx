'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ScanBarcode } from 'lucide-react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'
import { ScanInput } from '@/components/ui/ScanInput'
import { StatusMessage } from '@/components/ui/StatusMessage'

type ReturnedLoan = {
  book_title: string
  loan_banned_until: string | null
  loan_id: string
  overdue_days: number
  returned_on: string
  school_book_code: string | null
  student_name: string
}

type ReturnResponse = {
  data?: ReturnedLoan[]
  error?: {
    code: string
    message: string
  }
}

type ReturnStatus = {
  loan: ReturnedLoan
  variant: 'success' | 'error'
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`
}

function getReturnMessage(loan: ReturnedLoan) {
  if (loan.overdue_days > 0 && loan.loan_banned_until) {
    return `"${loan.book_title}" 반납 완료. ${loan.student_name} 학생은 연체 ${loan.overdue_days}일로 ${formatKoreanDate(
      loan.loan_banned_until
    )}까지 대출할 수 없습니다.`
  }

  return `"${loan.book_title}" 반납 완료`
}

export default function AutoReturnForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [bookCode, setBookCode] = useState('')
  const [isReturning, setIsReturning] = useState(false)
  const [history, setHistory] = useState<ReturnStatus[]>([])
  const isComposingRef = useRef(false)

  function addHistory(loan: ReturnedLoan, variant: 'success' | 'error') {
    setHistory((current) => [{ loan, variant }, ...current.slice(0, 9)])
  }

  async function processReturn(code: string) {
    const trimmed = normalizeBarcodeInput(code)
    if (!trimmed || isReturning) return

    setIsReturning(true)

    try {
      const response = await fetch('/api/returns', {
        body: JSON.stringify({ schoolBookCodes: [trimmed] }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = (await response.json()) as ReturnResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '반납 처리에 실패했습니다.')
      }

      const returnedLoan = payload.data?.[0]

      if (returnedLoan) {
        addHistory(returnedLoan, 'success')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '반납 처리에 실패했습니다.'
      addHistory(
        {
          book_title: trimmed,
          loan_banned_until: null,
          loan_id: '',
          overdue_days: 0,
          returned_on: new Date().toISOString().slice(0, 10),
          school_book_code: trimmed,
          student_name: '',
        },
        'error'
      )
      // eslint-disable-next-line no-console
      console.error('Return failed:', message)
    } finally {
      setIsReturning(false)
      setBookCode('')
      inputRef.current?.focus()
    }
  }

  function handleEnter() {
    const trimmed = normalizeBarcodeInput(bookCode)
    if (trimmed) {
      void processReturn(trimmed)
    }
  }

  function handleCompositionEnd(value: string) {
    isComposingRef.current = false
    setBookCode(normalizeBarcodeInput(value))
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <RotateCcw className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">도서 반납</h1>
          <p className="mt-1 text-sm text-gray-600">반납할 도서의 바코드를 스캔하면 자동으로 반납 처리됩니다.</p>
        </div>
      </div>

      <ScanInput
        ref={inputRef}
        id="return-book-code"
        label="도서 바코드"
        placeholder="도서 바코드를 스캔하세요"
        value={bookCode}
        onChangeValue={(value) => setBookCode(isComposingRef.current ? value : normalizeBarcodeInput(value))}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={handleCompositionEnd}
        onEnter={handleEnter}
        loading={isReturning}
        helperText="스캔하면 즉시 반납 처리됩니다. 연체 시 자동으로 대출 금지 기간이 적용됩니다."
      />

      {history.length > 0 ? (
        <div className="mt-4 space-y-2">
          {history.map((item, index) => (
            <StatusMessage
              key={`${item.loan.loan_id ?? item.loan.school_book_code}-${index}`}
              variant={item.variant}
              live={false}
            >
              {item.variant === 'success' ? getReturnMessage(item.loan) : `"${item.loan.book_title}" 반납 실패`}
            </StatusMessage>
          ))}
        </div>
      ) : null}
    </div>
  )
}
