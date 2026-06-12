import { type CompositionEvent, type KeyboardEvent, forwardRef, type InputHTMLAttributes } from 'react'
import { Loader2, ScanBarcode } from 'lucide-react'

type ScanInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onCompositionEnd' | 'onCompositionStart' | 'onKeyDown' | 'onChange' | 'value' | 'id' | 'label'
> & {
  id: string
  label: string
  value: string
  onChangeValue: (value: string) => void
  onCompositionStart?: () => void
  onCompositionEnd?: (value: string) => void
  onEnter?: () => void
  loading?: boolean
  helperText?: string
}

export const ScanInput = forwardRef<HTMLInputElement, ScanInputProps>(
  function ScanInput(
    {
      id,
      label,
      value,
      onChangeValue,
      onCompositionStart,
      onCompositionEnd,
      onEnter,
      loading = false,
      helperText,
      disabled = false,
      placeholder,
      className = '',
      ...props
    },
    ref
  ) {
    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key !== 'Enter') return
      if (event.nativeEvent.isComposing) return
      event.preventDefault()
      onEnter?.()
    }

    function handleCompositionStart() {
      onCompositionStart?.()
    }

    function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
      onCompositionEnd?.(event.currentTarget.value)
    }

    return (
      <div className={className}>
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            {...props}
            id={id}
            ref={ref}
            value={value}
            disabled={disabled || loading}
            onChange={(event) => onChangeValue(event.target.value)}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={handleKeyDown}
            className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            placeholder={placeholder}
            type="text"
            aria-describedby={helperText ? `${id}-helper` : undefined}
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-600" />
          ) : null}
        </div>
        {helperText ? (
          <p id={`${id}-helper`} className="mt-1.5 text-xs text-gray-500">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  }
)
