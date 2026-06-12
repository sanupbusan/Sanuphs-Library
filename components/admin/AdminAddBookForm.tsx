'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookPlus, Loader2, Save, Search } from 'lucide-react'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import { ScanInput } from '@/components/ui/ScanInput'
import { StatusMessage } from '@/components/ui/StatusMessage'
import { WorkflowStepCard } from '@/components/ui/WorkflowStepCard'

type CreateBookResponse = {
  error?: {
    code: string
    message: string
  }
}

type LookupBookResponse = {
  data?: {
    author: string
    isbn: string
    publisher: string
    title: string
  }
  error?: {
    code: string
    message: string
  }
}

type BookFormState = {
  author: string
  isbn: string
  publisher: string
  schoolBookCode: string
  title: string
}

type Step = 'isbn' | 'info' | 'code'

const initialFormState: BookFormState = {
  author: '',
  isbn: '',
  publisher: '',
  schoolBookCode: '',
  title: '',
}

function sanitizeIsbn(value: string) {
  return normalizeIsbnInput(value)
}

function sanitizeSchoolBookCode(value: string) {
  return normalizeBarcodeInput(value)
}

function trimFormState(form: BookFormState) {
  return {
    author: form.author.trim(),
    isbn: form.isbn.trim(),
    publisher: form.publisher.trim(),
    schoolBookCode: form.schoolBookCode.trim(),
    title: form.title.trim(),
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

export default function AdminAddBookForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState<BookFormState>(initialFormState)
  const [activeStep, setActiveStep] = useState<Step>('isbn')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLookingUpIsbn, setIsLookingUpIsbn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isbnInputRef = useRef<HTMLInputElement>(null)
  const schoolBookCodeInputRef = useRef<HTMLInputElement>(null)

  const isInfoComplete = useMemo(() => {
    const trimmed = trimFormState(form)
    return Boolean(trimmed.title && trimmed.author && trimmed.publisher)
  }, [form])

  useEffect(() => {
    let didCancel = false

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/admin/session', {
          cache: 'no-store',
        })

        if (!didCancel && (response.status === 401 || response.status === 403)) {
          router.replace('/admin/login')
          return
        }

        if (!didCancel) {
          setIsCheckingSession(false)
        }
      } catch {
        if (!didCancel) {
          setErrorMessage('세션 확인에 실패했습니다.')
          setIsCheckingSession(false)
        }
      }
    }

    void checkSession()

    return () => {
      didCancel = true
    }
  }, [router])

  useEffect(() => {
    if (isCheckingSession) return

    const paramIsbn = searchParams.get('isbn') ?? ''
    const paramSchoolBookCode = searchParams.get('schoolBookCode') ?? ''

    if (paramIsbn || paramSchoolBookCode) {
      setForm((current) => ({
        ...current,
        isbn: sanitizeIsbn(paramIsbn),
        schoolBookCode: sanitizeSchoolBookCode(paramSchoolBookCode),
      }))
    }

    if (paramIsbn) {
      setActiveStep('isbn')
      window.setTimeout(() => isbnInputRef.current?.focus(), 0)
    } else if (paramSchoolBookCode) {
      setActiveStep('code')
      window.setTimeout(() => schoolBookCodeInputRef.current?.focus(), 0)
    } else {
      setActiveStep('isbn')
      window.setTimeout(() => isbnInputRef.current?.focus(), 0)
    }
  }, [isCheckingSession, searchParams])

  function clearMessages() {
    setErrorMessage('')
    setInfoMessage('')
    setSuccessMessage('')
  }

  function updateField(field: keyof BookFormState, value: string) {
    const nextValue =
      field === 'isbn'
        ? sanitizeIsbn(value)
        : field === 'schoolBookCode'
          ? sanitizeSchoolBookCode(value)
          : value

    setSuccessMessage('')
    setForm((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  async function submitBook(nextForm = form) {
    const input = trimFormState(nextForm)

    if (!input.isbn || !input.schoolBookCode || !input.title || !input.author || !input.publisher) {
      setErrorMessage('책 이름, 저자, 출판사, ISBN 코드, 학교 내 도서 코드를 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    clearMessages()

    try {
      const response = await fetch('/api/admin/books', {
        body: JSON.stringify(input),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = (await response.json()) as CreateBookResponse

      if (response.status === 401 || response.status === 403) {
        router.replace('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '책 등록에 실패했습니다.')
      }

      setForm(initialFormState)
      setActiveStep('isbn')
      setSuccessMessage('책이 등록되었습니다. 다음 ISBN 바코드를 스캔해주세요.')
      if (searchParams.toString()) {
        router.replace('/admin/add_books', { scroll: false })
      }
      router.refresh()
      window.setTimeout(() => isbnInputRef.current?.focus(), 0)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '책 등록에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function lookupIsbn(nextIsbn = form.isbn) {
    const isbn = sanitizeIsbn(nextIsbn.trim())

    if (!isbn) {
      setErrorMessage('ISBN 코드를 입력해주세요.')
      setInfoMessage('')
      return
    }

    clearMessages()
    setIsLookingUpIsbn(true)

    try {
      const params = new URLSearchParams({ isbn })
      let response: Response

      try {
        response = await fetch(`/api/admin/books/isbn?${params.toString()}`, {
          cache: 'no-store',
        })
      } catch {
        throw new Error('ISBN 조회 API에 연결하지 못했습니다. 개발 서버가 실행 중인지 확인해주세요.')
      }

      const payload = await readJsonResponse<LookupBookResponse>(response)

      if (response.status === 401 || response.status === 403) {
        router.replace('/admin/login')
        return
      }

      if (response.status === 404) {
        setForm((current) => ({
          ...current,
          isbn,
        }))
        setInfoMessage(payload.error?.message ?? 'ISBN 정보를 찾지 못했습니다. 책 정보를 직접 입력해주세요.')
        setActiveStep('info')
        return
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? 'ISBN 정보 조회에 실패했습니다.')
      }

      const book = payload.data

      setForm((current) => ({
        ...current,
        author: book.author || current.author,
        isbn: book.isbn || isbn,
        publisher: book.publisher || current.publisher,
        title: book.title || current.title,
      }))
      setInfoMessage('ISBN 정보를 불러왔습니다. 내용을 확인하고 필요하면 수정해주세요.')
      setActiveStep('info')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ISBN 정보 조회에 실패했습니다.')
    } finally {
      setIsLookingUpIsbn(false)
    }
  }

  function handleIsbnEnter() {
    void lookupIsbn()
  }

  function handleSchoolBookCodeEnter() {
    const nextForm = trimFormState(form)

    if (!isInfoComplete) {
      setErrorMessage('책 이름, 저자, 출판사를 먼저 입력해주세요.')
      setActiveStep('info')
      return
    }

    void submitBook(nextForm)
  }

  function moveToCodeStep() {
    if (!isInfoComplete) {
      setErrorMessage('책 이름, 저자, 출판사를 모두 입력해주세요.')
      return
    }

    clearMessages()
    setActiveStep('code')
    window.setTimeout(() => schoolBookCodeInputRef.current?.focus(), 0)
  }

  function handleReset() {
    setForm(initialFormState)
    setActiveStep('isbn')
    clearMessages()
    window.setTimeout(() => isbnInputRef.current?.focus(), 0)
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <BookPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">새 책 추가</h1>
            <p className="mt-1 text-sm text-gray-600">ISBN 바코드로 책 정보를 찾고, 학교 내 도서 코드를 등록합니다.</p>
          </div>
        </div>

        <div className="space-y-4">
          <WorkflowStepCard
            step={1}
            title="ISBN 스캔"
            description="책 뒷면의 ISBN 바코드를 스캔하면 도서 정보를 자동으로 불러옵니다."
            state={activeStep === 'isbn' ? 'current' : 'complete'}
          >
            <div className="flex gap-2">
              <ScanInput
                ref={isbnInputRef}
                id="isbn"
                label="ISBN 코드"
                value={form.isbn}
                onChangeValue={(value) => updateField('isbn', value)}
                onEnter={handleIsbnEnter}
                loading={isLookingUpIsbn}
                disabled={isSubmitting}
                placeholder="ISBN 바코드 스캔"
                helperText="바코드 스캔 또는 Enter 키로 조회할 수 있습니다."
                className="flex-1"
              />
              <button
                type="button"
                title="ISBN 정보 조회"
                disabled={isLookingUpIsbn || isSubmitting}
                onClick={handleIsbnEnter}
                className="mt-auto inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
              >
                {isLookingUpIsbn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </button>
            </div>
          </WorkflowStepCard>

          <WorkflowStepCard
            step={2}
            title="도서 정보 확인"
            description="자동으로 불러온 정보를 확인하고 필요한 부분만 수정해주세요."
            state={activeStep === 'info' ? 'current' : activeStep === 'isbn' ? 'locked' : 'complete'}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="book-title" className="mb-2 block text-sm font-medium text-gray-700">
                  책 이름
                </label>
                <input
                  id="book-title"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  disabled={activeStep === 'isbn' || isSubmitting}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="책 이름"
                  type="text"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="author" className="mb-2 block text-sm font-medium text-gray-700">
                    저자
                  </label>
                  <input
                    id="author"
                    value={form.author}
                    onChange={(event) => updateField('author', event.target.value)}
                    disabled={activeStep === 'isbn' || isSubmitting}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="저자"
                    type="text"
                  />
                </div>

                <div>
                  <label htmlFor="publisher" className="mb-2 block text-sm font-medium text-gray-700">
                    출판사
                  </label>
                  <input
                    id="publisher"
                    value={form.publisher}
                    onChange={(event) => updateField('publisher', event.target.value)}
                    disabled={activeStep === 'isbn' || isSubmitting}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="출판사"
                    type="text"
                  />
                </div>
              </div>

              {activeStep === 'info' ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={moveToCodeStep}
                    disabled={!isInfoComplete || isSubmitting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    다음
                  </button>
                </div>
              ) : null}
            </div>
          </WorkflowStepCard>

          <WorkflowStepCard
            step={3}
            title="학교 내 도서 코드 등록"
            description="학교에서 부착한 도서 코드 바코드를 스캔하면 등록이 완료됩니다."
            state={activeStep === 'code' ? 'current' : 'locked'}
          >
            <ScanInput
              ref={schoolBookCodeInputRef}
              id="school-book-code"
              label="학교 내 도서 코드"
              value={form.schoolBookCode}
              onChangeValue={(value) => updateField('schoolBookCode', value)}
              onEnter={handleSchoolBookCodeEnter}
              disabled={activeStep !== 'code' || isSubmitting}
              loading={isSubmitting}
              placeholder="학교 바코드 스캔"
            />
          </WorkflowStepCard>
        </div>

        {errorMessage ? (
          <div className="mt-4">
            <StatusMessage variant="error">{errorMessage}</StatusMessage>
          </div>
        ) : null}

        {infoMessage ? (
          <div className="mt-4">
            <StatusMessage variant="info">{infoMessage}</StatusMessage>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4">
            <StatusMessage variant="success">{successMessage}</StatusMessage>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            onClick={() => router.push('/admin/books')}
            type="button"
          >
            취소
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            onClick={handleReset}
            type="button"
          >
            초기화
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting || activeStep !== 'code'}
            onClick={() => void submitBook()}
            type="button"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            등록
          </button>
        </div>
      </div>
    </section>
  )
}
