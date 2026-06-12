'use client'

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Barcode, BookPlus, Loader2, Save, Search } from 'lucide-react'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'

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
  const isbnInputRef = useRef<HTMLInputElement>(null)
  const schoolBookCodeInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<BookFormState>(initialFormState)
  const [errorMessage, setErrorMessage] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLookingUpIsbn, setIsLookingUpIsbn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lookupMessage, setLookupMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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
      isbnInputRef.current?.focus()
    } else if (paramSchoolBookCode) {
      schoolBookCodeInputRef.current?.focus()
    } else {
      isbnInputRef.current?.focus()
    }
  }, [isCheckingSession, searchParams])

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

  function focusIsbnInput() {
    window.setTimeout(() => {
      const input = isbnInputRef.current
      input?.focus()
      input?.select()
    }, 0)
  }

  async function submitBook(nextForm = form) {
    const input = trimFormState(nextForm)

    if (!input.isbn || !input.schoolBookCode || !input.title || !input.author || !input.publisher) {
      setErrorMessage('책 이름, 저자, 출판사, ISBN 코드, 학교 내 도서 코드를 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

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
      setLookupMessage('')
      setSuccessMessage('책이 등록되었습니다. 다음 ISBN 바코드를 스캔해주세요.')
      if (searchParams.toString()) {
        router.replace('/admin/add_books', { scroll: false })
      }
      router.refresh()
      focusIsbnInput()
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
      return false
    }

    setErrorMessage('')
    setLookupMessage('')
    setSuccessMessage('')
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
        return false
      }

      if (response.status === 404) {
        setForm((current) => ({
          ...current,
          isbn,
        }))
        setLookupMessage(payload.error?.message ?? 'ISBN 정보를 찾지 못했습니다. 책 정보를 직접 입력해주세요.')
        return false
      }

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? 'ISBN 정보 조회에 실패했습니다.')
      }

      setForm((current) => ({
        ...current,
        author: payload.data?.author || current.author,
        isbn: payload.data?.isbn || isbn,
        publisher: payload.data?.publisher || current.publisher,
        title: payload.data?.title || current.title,
      }))
      setLookupMessage('ISBN 정보를 불러왔습니다.')

      return true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ISBN 정보 조회에 실패했습니다.')
      return false
    } finally {
      setIsLookingUpIsbn(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitBook()
  }

  function handleIsbnKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    void lookupIsbn().finally(() => {
      schoolBookCodeInputRef.current?.focus()
    })
  }

  function handleSchoolBookCodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    const nextForm = trimFormState(form)

    if (nextForm.title && nextForm.author && nextForm.publisher) {
      void submitBook(nextForm)
      return
    }

    titleInputRef.current?.focus()
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
            <p className="mt-1 text-sm text-gray-600">ISBN 바코드와 학교 내 도서 코드를 순서대로 입력합니다.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="isbn" className="mb-2 block text-sm font-medium text-gray-700">
                ISBN 코드
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="isbn"
                    ref={isbnInputRef}
                    value={form.isbn}
                    onChange={(event) => updateField('isbn', event.target.value)}
                    onKeyDown={handleIsbnKeyDown}
                    className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    inputMode="numeric"
                    placeholder="ISBN 바코드 스캔"
                    type="text"
                  />
                </div>
                <button
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
                  disabled={isLookingUpIsbn || isSubmitting}
                  onClick={() => {
                    void lookupIsbn().finally(() => {
                      schoolBookCodeInputRef.current?.focus()
                    })
                  }}
                  title="ISBN 정보 조회"
                  type="button"
                >
                  {isLookingUpIsbn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              {lookupMessage ? (
                <p className="mt-2 text-xs text-gray-500">{lookupMessage}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="school-book-code" className="mb-2 block text-sm font-medium text-gray-700">
                학교 내 도서 코드
              </label>
              <div className="relative">
                <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="school-book-code"
                  ref={schoolBookCodeInputRef}
                  value={form.schoolBookCode}
                  onChange={(event) => updateField('schoolBookCode', event.target.value)}
                  onKeyDown={handleSchoolBookCodeKeyDown}
                  className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  placeholder="학교 바코드 스캔"
                  type="text"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label htmlFor="book-title" className="mb-2 block text-sm font-medium text-gray-700">
                책 이름
              </label>
              <input
                id="book-title"
                ref={titleInputRef}
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
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
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
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
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  placeholder="출판사"
                  type="text"
                />
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              등록
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
