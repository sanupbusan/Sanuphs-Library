'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

type Toast = {
  id: number
  message: string
  variant: ToastVariant
}

type AddToastOptions = {
  durationMs?: number
}

type ToastContextValue = {
  addToast: (message: string, variant?: ToastVariant, options?: AddToastOptions) => void
  removeToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function getToastClassName(variant: ToastVariant) {
  if (variant === 'success') {
    return 'bg-green-600 text-white'
  }

  if (variant === 'error') {
    return 'bg-red-600 text-white'
  }

  return 'bg-gray-900 text-white'
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', options: AddToastOptions = {}) => {
      const id = ++toastIdRef.current
      const durationMs = options.durationMs ?? 1800

      setToasts((current) => [...current, { id, message, variant }])
      window.setTimeout(() => removeToast(id), durationMs)
    },
    [removeToast]
  )

  const value = useMemo(
    () => ({
      addToast,
      removeToast,
    }),
    [addToast, removeToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-opacity hover:opacity-90',
              getToastClassName(toast.variant)
            )}
            onClick={() => removeToast(toast.id)}
            type="button"
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider.')
  }

  return context
}
