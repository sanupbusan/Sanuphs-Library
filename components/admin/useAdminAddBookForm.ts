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
import {
  getAdminBookLookupSuccessStep,
  getMissingAdminBookRequiredFieldsMessage,
  shouldAutoLookupAdminBookIsbn,
} from '@/lib/admin-book-input'
import { useInputFocus } from '@/hooks/useInputFocus'
import { useStatusMessages } from '@/hooks/useStatusMessages'
import type { AdminBookRow } from '@/types/library'

type UseAdminAddBookFormOptions = {
  onBookCreated?: (book: AdminBookRow) => void
}

const ISBN_SCAN_LOOKUP_DELAY_MS = 80

function shouldRedirectToLogin(error: unknown) {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403)
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
  const [shouldFocusNextIsbn, setShouldFocusNextIsbn] = useState(false)
  const activeLookupIsbnRef = useRef('')
  const lastAutoLookupIsbnRef = useRef('')

  function updateFormField(field: keyof AdminBookFormState, value: string) {
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

    const missingFieldsMessage = getMissingAdminBookRequiredFieldsMessage(input)

    if (missingFieldsMessage) {
      setErrorMessage(missingFieldsMessage)
      return
    }

    setIsSubmitting(true)
    clearMessages()

    try {
      const createdBook = await createAdminBook(input)
      resetDraft()
      onBookCreated?.(createdBook)
      setSuccessMessage('책이 등록되었습니다. 다음 책을 등록해주세요.')
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
      startManualEntry()
      return
    }

    if (activeLookupIsbnRef.current === isbn) {
      return
    }

    activeLookupIsbnRef.current = isbn
    clearMessages()
    setIsLookingUpIsbn(true)

    try {
      const book = await lookupAdminBookByIsbn(isbn)
      const nextForm = {
        author: book.author || form.author,
        isbn: book.isbn || isbn,
        publisher: book.publisher || form.publisher,
        schoolBookCode: form.schoolBookCode,
        title: book.title || form.title,
      }
      const nextStep = getAdminBookLookupSuccessStep(nextForm)

      applyLookupResult(book, isbn)
      setInfoMessage(
        nextStep === 'code'
          ? 'ISBN 정보를 불러왔습니다. 학교 내 도서 코드를 스캔해주세요.'
          : 'ISBN 정보를 불러왔습니다. 부족한 정보를 입력해주세요.'
      )
      setActiveStep(nextStep)
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
      if (activeLookupIsbnRef.current === isbn) {
        activeLookupIsbnRef.current = ''
      }

      setIsLookingUpIsbn(false)
    }
  }

  function handleIsbnEnter() {
    void lookupIsbn()
  }

  function startManualEntry() {
    clearMessages()
    updateField('isbn', '')
    setInfoMessage('ISBN 없이 책 정보를 직접 입력해주세요.')
    setActiveStep('info')
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
    const isbn = sanitizeAdminBookIsbn(form.isbn)

    if (!shouldAutoLookupAdminBookIsbn({
      activeStep,
      isbn,
      isLookingUpIsbn,
      lastAutoLookupIsbn: lastAutoLookupIsbnRef.current,
    })) {
      return
    }

    const lookupTimer = window.setTimeout(() => {
      lastAutoLookupIsbnRef.current = isbn
      void lookupIsbn(isbn)
    }, ISBN_SCAN_LOOKUP_DELAY_MS)

    return () => {
      window.clearTimeout(lookupTimer)
    }
  }, [activeStep, form.isbn, isLookingUpIsbn])

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
  }, [activeStep, clearMessages, isInfoComplete, isSubmitting, setActiveStep])

  useEffect(() => {
    if (activeStep !== 'code' || isSubmitting) {
      return
    }

    focusSchoolBookCodeInput({ select: true })
  }, [activeStep, focusSchoolBookCodeInput, isSubmitting])

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
    handleManualEntry: startManualEntry,
    handleSchoolBookCodeEnter,
    infoMessage,
    isInfoComplete,
    isLookingUpIsbn,
    isSubmitting,
    isbnInputRef,
    schoolBookCodeInputRef,
    successMessage,
    updateField: updateFormField,
  }
}
