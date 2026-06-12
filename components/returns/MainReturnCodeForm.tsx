'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'

type ReturnableLoanResponse = {
  data?: {
    loan_id: string
  } | null
  error?: {
    code: string
    message: string
  }
}

export default function MainReturnCodeForm() {
  const router = useRouter()
  const [schoolBookCode, setSchoolBookCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextSchoolBookCode = normalizeBarcodeInput(schoolBookCode)

    if (!nextSchoolBookCode || isChecking) {
      return
    }

    setIsChecking(true)
    setErrorMessage('')

    try {
      const params = new URLSearchParams({ code: nextSchoolBookCode })
      const response = await fetch(`/api/returns/loans?${params.toString()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as ReturnableLoanResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '반납 정보를 확인하지 못했습니다.')
      }

      if (payload.data?.loan_id) {
        router.push(`/returns?code=${encodeURIComponent(nextSchoolBookCode)}`)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '반납 정보를 확인하지 못했습니다.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 max-w-md rounded-2xl border border-primary-100 bg-white/80 p-3 shadow-sm backdrop-blur">
      <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="return-school-book-code">
        반납할 학교 도서 코드
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="return-school-book-code"
          value={schoolBookCode}
          onChange={(event) => setSchoolBookCode(normalizeBarcodeInput(event.target.value))}
          className="h-11 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="학교 도서 코드 입력"
          type="text"
        />
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
          disabled={isChecking}
          type="submit"
        >
          {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          반납 확인
        </button>
      </div>
      {errorMessage ? <p className="mt-2 text-xs font-medium text-red-600">{errorMessage}</p> : null}
      <p className="mt-2 text-xs text-gray-500">대출 중인 책 코드일 때만 반납 화면으로 이동합니다.</p>
    </form>
  )
}
