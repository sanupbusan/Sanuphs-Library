'use client'

import { useCallback, useRef } from 'react'

type FocusOptions = {
  select?: boolean
}

export function useInputFocus<TElement extends HTMLInputElement>() {
  const inputRef = useRef<TElement>(null)

  const focusInput = useCallback((options: FocusOptions = {}) => {
    window.setTimeout(() => {
      const input = inputRef.current

      input?.focus()

      if (options.select) {
        input?.select()
      }
    }, 0)
  }, [])

  return {
    focusInput,
    inputRef,
  }
}
