'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAdminBook, lookupAdminBookByIsbn } from '@/components/admin/adminAddBookApi'
import {
  sanitizeAdminBookIsbn,
  useAdminAddBookDraft,
  type AdminBookFormState,
} from '@/components/admin/useAdminAddBookDraft'
import { ApiClientError } from '@/lib/api-client'
import { useInputFocus } from '@/hooks/useInputFocus'
import { useStatusMessages } from '@/hooks/useStatusMessages'
import type { AdminBookRow } from '@/types/library'

type UseAdminAddBookFormOptions = {
  onBookCreated?: (book: AdminBookRow) => void
}

function shouldRedirectToLogin(error: unknown) {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403)
}

function isLookupInfoComplete(book: Pick<AdminBookRow, 'title' | 'author' | 'publisher'>) {
  return Boolean(book.title?.trim() && book.author?.trim() && book.publisher?.trim())
}

export function useAdminAddBookForm({ onBookCreated }: UseAdminAddBookFormOptions = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    activeStep,
    applyLookupResult,
    applyPrefillParams,
    form,
    getTrimmedForm,
    isInfoComplete,
    resetDraft,
    setActiveStep,
    setForm,
    updateField,
  } = useAdminAddBookDraft()
  const {
    clearMessages,
    errorMessage,
    infoMessage,
    setErrorMessage,
    setInfoMessage,
    setSuccessMessage,
    successMessage,
  } = useStatusMessages()
  const { focusInput: focusIsbnInput, inputRef: isbnInputRef } = useInputFocus<HTMLInputElement>()
  const {
    focusInput: focusSchoolBookCodeInput,
    inputRef: schoolBookCodeInputRef,
  } = useInputFocus<HTMLInputElement>()
  const [isLookingUpIsbn, setIsLookingUpIsbn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shouldFocusSchoolBookCode, setShouldFocusSchoolBookCode] = useState(false)
  const [shouldFocusNextIsbn, setShouldFocusNextIsbn] = useState(false)
  const composingFieldRef = useRef<keyof AdminBookFormState | null>(null)

  function updateFormField(field: keyof AdminBookFormState, value: string) {
    setSuccessMessage('')

    if (composingFieldRef.current === field) {
      setForm((current) => ({
        ...current,
        [field]: value,
      }))
      return
    }

    updateField(field, value)
  }

  function handleScanCompositionStart(field: keyof AdminBookFormState) {
    composingFieldRef.current = field
  }

  function handleScanCompositionEnd(field: keyof AdminBookFormState, value: string) {
    if (composingFieldRef.current === field) {
      composingFieldRef.current = null
    }

    setSuccessMessage('')
    updateField(field, value)
  }

  async function submitBook(nextForm = form) {
    const input = nextForm === form ? getTrimmedForm() : {
      author: nextForm.author.trim(),
      isbn: nextForm.isbn.trim(),
      publisher: nextForm.publisher.trim(),
      schoolBookCode: nextForm.schoolBookCode.trim(),
      title: nextForm.title.trim(),
    }

    if (!input.isbn || !input.schoolBookCode || !input.title || !input.author || !input.publisher) {
      setErrorMessage('책 이름, 저자, 출판사, ISBN 코드, 학교 내 도서 코드를 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    clearMessages()

    try {
      const createdBook = await createAdminBook(input)
      resetDraft()
      onBookCreated?.(createdBook)
      setSuccessMessage('책이 등록되었습니다. 다음 ISBN 바코드를 스캔해주세요.')
      setShouldFocusNextIsbn(true)

      if (searchParams.toString()) {
        router.replace('/admin/add_books', { scroll: false })
      }
    } catch (error) {
      if (shouldRedirectToLogin(error)) {
        router.replace('/admin/login')
        return
      }

      setErrorMessage(error instanceof Error ? error.message : '책 등록에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function lookupIsbn(nextIsbn = form.isbn) {
    const isbn = sanitizeAdminBookIsbn(nextIsbn.trim())

    if (!isbn) {
      setErrorMessage('ISBN 코드를 입력해주세요.')
      return
    }

    clearMessages()
    setIsLookingUpIsbn(true)

    try {
      const book = await lookupAdminBookByIsbn(isbn)

      applyLookupResult(book, isbn)
      if (isLookupInfoComplete(book)) {
        clearMessages()
        setActiveStep('code')
        setShouldFocusSchoolBookCode(true)
        return
      }

      setInfoMessage('ISBN 정보를 불러왔습니다. 내용을 확인하고 필요하면 수정해주세요.')
      setActiveStep('info')
    } catch (error) {
      if (shouldRedirectToLogin(error)) {
        router.replace('/admin/login')
        return
      }

      if (error instanceof ApiClientError && error.status === 404) {
        updateField('isbn', isbn)
        setInfoMessage(error.message || 'ISBN 정보를 찾지 못했습니다. 책 정보를 직접 입력해주세요.')
        setActiveStep('info')
        return
      }

      setErrorMessage(error instanceof Error ? error.message : 'ISBN 정보 조회에 실패했습니다.')
    } finally {
      setIsLookingUpIsbn(false)
    }
  }

  function handleIsbnEnter() {
    void lookupIsbn()
  }

  function handleSchoolBookCodeEnter() {
    const nextForm = getTrimmedForm()

    if (!isInfoComplete) {
      setErrorMessage('책 이름, 저자, 출판사를 먼저 입력해주세요.')
      setActiveStep('info')
      return
    }

    void submitBook(nextForm)
  }

  useEffect(() => {
    const paramIsbn = searchParams.get('isbn') ?? ''
    const paramSchoolBookCode = searchParams.get('schoolBookCode') ?? ''

    applyPrefillParams(paramIsbn, paramSchoolBookCode)

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
  }, [applyPrefillParams, focusIsbnInput, focusSchoolBookCodeInput, searchParams, setActiveStep])

  useEffect(() => {
    if (activeStep !== 'info' || !isInfoComplete || isSubmitting) {
      return
    }

    clearMessages()
    setActiveStep('code')
    setShouldFocusSchoolBookCode(true)
  }, [activeStep, clearMessages, isInfoComplete, isSubmitting, setActiveStep])

  useEffect(() => {
    if (!shouldFocusSchoolBookCode || activeStep !== 'code' || isSubmitting) {
      return
    }

    focusSchoolBookCodeInput({ select: true })
    setShouldFocusSchoolBookCode(false)
  }, [activeStep, focusSchoolBookCodeInput, isSubmitting, shouldFocusSchoolBookCode])

  useEffect(() => {
    if (!shouldFocusNextIsbn || isSubmitting || activeStep !== 'isbn') {
      return
    }

    focusIsbnInput({ select: true })
    setShouldFocusNextIsbn(false)
  }, [activeStep, focusIsbnInput, isSubmitting, shouldFocusNextIsbn])

  return {
    activeStep,
    errorMessage,
    form,
    handleIsbnEnter,
    handleSchoolBookCodeEnter,
    infoMessage,
    isInfoComplete,
    isLookingUpIsbn,
    isSubmitting,
    isbnInputRef,
    schoolBookCodeInputRef,
    successMessage,
    handleScanCompositionEnd,
    handleScanCompositionStart,
    updateField: updateFormField,
  }
}
