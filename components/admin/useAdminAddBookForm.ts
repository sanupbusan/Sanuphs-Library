'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import { readJsonResponse } from '@/lib/api-client'
import type { ApiResponse, IsbnLookupResult } from '@/types/library'

type CreateBookResponse = ApiResponse<unknown>
type LookupBookResponse = ApiResponse<IsbnLookupResult>

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

export function useAdminAddBookForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState<BookFormState>(initialFormState)
  const [activeStep, setActiveStep] = useState<Step>('isbn')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLookingUpIsbn, setIsLookingUpIsbn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isbnInputRef = useRef<HTMLInputElement>(null)
  const schoolBookCodeInputRef = useRef<HTMLInputElement>(null)

  const isInfoComplete = useMemo(() => {
    const trimmed = trimFormState(form)

    return Boolean(trimmed.title && trimmed.author && trimmed.publisher)
  }, [form])

  function focusIsbnInput() {
    window.setTimeout(() => isbnInputRef.current?.focus(), 0)
  }

  function focusSchoolBookCodeInput() {
    window.setTimeout(() => schoolBookCodeInputRef.current?.focus(), 0)
  }

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
      const payload = await readJsonResponse<CreateBookResponse>(response)

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
    focusSchoolBookCodeInput()
  }

  function handleReset() {
    setForm(initialFormState)
    setActiveStep('isbn')
    clearMessages()
    focusIsbnInput()
  }

  function handleCancel() {
    router.push('/admin/books')
  }

  useEffect(() => {
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
      focusIsbnInput()
    } else if (paramSchoolBookCode) {
      setActiveStep('code')
      focusSchoolBookCodeInput()
    } else {
      setActiveStep('isbn')
      focusIsbnInput()
    }
  }, [searchParams])

  return {
    activeStep,
    errorMessage,
    form,
    handleCancel,
    handleIsbnEnter,
    handleReset,
    handleSchoolBookCodeEnter,
    infoMessage,
    isInfoComplete,
    isLookingUpIsbn,
    isSubmitting,
    isbnInputRef,
    moveToCodeStep,
    schoolBookCodeInputRef,
    submitBook,
    successMessage,
    updateField,
  }
}
