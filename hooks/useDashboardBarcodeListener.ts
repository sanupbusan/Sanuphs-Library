import { useEffect, useRef } from 'react'
import { normalizeBarcodeInput } from '@/lib/barcode-input'

const STUDENT_NUMBER_PATTERN = /^[0-9]{5}$/
const BARCODE_TIMEOUT_MS = 100

type UseDashboardBarcodeListenerOptions = {
  onStudentNumber: (studentNumber: string) => void
  onReturnCode: (code: string) => void
}

export function useDashboardBarcodeListener({ onStudentNumber, onReturnCode }: UseDashboardBarcodeListenerOptions) {
  const barcodeBufferRef = useRef('')
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === 'Enter') {
        const buffer = normalizeBarcodeInput(barcodeBufferRef.current)
        barcodeBufferRef.current = ''
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current)
        }

        if (!buffer) return

        if (STUDENT_NUMBER_PATTERN.test(buffer)) {
          onStudentNumber(buffer)
        } else {
          onReturnCode(buffer)
        }
        return
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        barcodeBufferRef.current = normalizeBarcodeInput(barcodeBufferRef.current + event.key)
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current)
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          barcodeBufferRef.current = ''
        }, BARCODE_TIMEOUT_MS)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current)
      }
    }
  }, [onStudentNumber, onReturnCode])
}
