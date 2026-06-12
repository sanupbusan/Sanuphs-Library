'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ScanBarcode } from 'lucide-react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'

type ReturnResponse = {
  data?: {
    bookTitle: string
    returnedOn: string
    studentName: string
  }
  error?: {
    code: string
    message: string
  }
}

type Toast = {
  id: number
  message: string
  type: 'success' | 'error'
}

let toastIdCounter = 0

export default function AutoReturnForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [bookCode, setBookCode] = useState('')
  const [isReturning, setIsReturning] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  function addToast(message: string, type: 'success' | 'error') {
    const id = ++toastIdCounter
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 1000)
  }

  async function processReturn(code: string) {
    const trimmed = normalizeBarcodeInput(code)
    if (!trimmed || isReturning) return

    setIsReturning(true)

    try {
      const response = await fetch(`/api/returns/loans?code=${encodeURIComponent(trimmed)}`)
      const payload = (await response.json()) as ReturnResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '반납 처리에 실패했습니다.')
      }

      if (payload.data) {
        addToast(`"${payload.data.bookTitle}" 반납 완료`, 'success')
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : '반납 처리에 실패했습니다.', 'error')
    } finally {
      setIsReturning(false)
      setBookCode('')
      inputRef.current?.focus()
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === 'Enter') {
        const buffer = bookCode.trim()
        if (buffer) {
          void processReturn(buffer)
        }
        return
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        setBookCode((current) => normalizeBarcodeInput(current + event.key))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [bookCode])

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

      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={bookCode}
          onChange={(event) => setBookCode(normalizeBarcodeInput(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void processReturn(bookCode)
            }
          }}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="도서 바코드를 스캔하세요"
          type="text"
        />
      </div>

      {isReturning ? (
        <div className="mt-3 text-xs text-gray-500">반납 처리 중...</div>
      ) : null}

      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}
