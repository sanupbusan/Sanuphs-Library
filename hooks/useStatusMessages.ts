'use client'

import { useCallback, useState } from 'react'

export type StatusMessages = {
  errorMessage: string
  infoMessage: string
  successMessage: string
}

export function useStatusMessages() {
  const [messages, setMessages] = useState<StatusMessages>({
    errorMessage: '',
    infoMessage: '',
    successMessage: '',
  })

  const clearMessages = useCallback(() => {
    setMessages({
      errorMessage: '',
      infoMessage: '',
      successMessage: '',
    })
  }, [])

  const setErrorMessage = useCallback((message: string) => {
    setMessages({
      errorMessage: message,
      infoMessage: '',
      successMessage: '',
    })
  }, [])

  const setInfoMessage = useCallback((message: string) => {
    setMessages({
      errorMessage: '',
      infoMessage: message,
      successMessage: '',
    })
  }, [])

  const setSuccessMessage = useCallback((message: string) => {
    setMessages({
      errorMessage: '',
      infoMessage: '',
      successMessage: message,
    })
  }, [])

  return {
    ...messages,
    clearMessages,
    setErrorMessage,
    setInfoMessage,
    setSuccessMessage,
  }
}
