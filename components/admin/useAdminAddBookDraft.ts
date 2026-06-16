'use client'

import { useCallback, useMemo, useState } from 'react'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import type { IsbnLookupResult } from '@/types/library'

export type AdminBookFormState = {
  author: string
  isbn: string
  publisher: string
  schoolBookCode: string
  title: string
}

export type AdminBookFormInput = AdminBookFormState
export type AdminAddBookStep = 'isbn' | 'info' | 'code'

const initialFormState: AdminBookFormState = {
  author: '',
  isbn: '',
  publisher: '',
  schoolBookCode: '',
  title: '',
}

export function sanitizeAdminBookIsbn(value: string) {
  return normalizeIsbnInput(value)
}

export function sanitizeAdminSchoolBookCode(value: string) {
  return normalizeBarcodeInput(value)
}

export function trimAdminBookForm(form: AdminBookFormState): AdminBookFormInput {
  return {
    author: form.author.trim(),
    isbn: form.isbn.trim(),
    publisher: form.publisher.trim(),
    schoolBookCode: form.schoolBookCode.trim(),
    title: form.title.trim(),
  }
}

export function useAdminAddBookDraft() {
  const [form, setForm] = useState<AdminBookFormState>(initialFormState)
  const [activeStep, setActiveStep] = useState<AdminAddBookStep>('isbn')

  const isInfoComplete = useMemo(() => {
    const trimmed = trimAdminBookForm(form)

    return Boolean(trimmed.title && trimmed.author && trimmed.publisher)
  }, [form])

  const updateField = useCallback((field: keyof AdminBookFormState, value: string) => {
    const nextValue =
      field === 'isbn'
        ? sanitizeAdminBookIsbn(value)
        : field === 'schoolBookCode'
          ? sanitizeAdminSchoolBookCode(value)
          : value

    setForm((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }, [])

  const applyLookupResult = useCallback((book: IsbnLookupResult, fallbackIsbn: string) => {
    setForm((current) => ({
      ...current,
      author: book.author || current.author,
      isbn: book.isbn || fallbackIsbn,
      publisher: book.publisher || current.publisher,
      title: book.title || current.title,
    }))
  }, [])

  const applyPrefillParams = useCallback((isbn: string, schoolBookCode: string) => {
    if (!isbn && !schoolBookCode) {
      return
    }

    setForm((current) => ({
      ...current,
      isbn: sanitizeAdminBookIsbn(isbn),
      schoolBookCode: sanitizeAdminSchoolBookCode(schoolBookCode),
    }))
  }, [])

  const resetDraft = useCallback(() => {
    setForm(initialFormState)
    setActiveStep('isbn')
  }, [])

  return {
    activeStep,
    applyLookupResult,
    applyPrefillParams,
    form,
    getTrimmedForm: () => trimAdminBookForm(form),
    isInfoComplete,
    resetDraft,
    setActiveStep,
    setForm,
    updateField,
  }
}
