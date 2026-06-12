import { type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'

type StatusVariant = 'error' | 'success' | 'info' | 'warning'

type StatusMessageProps = {
  variant: StatusVariant
  children: ReactNode
  className?: string
  live?: boolean
}

const variantStyles: Record<StatusVariant, { bg: string; border: string; text: string; icon: typeof AlertCircle } & { ariaRole: 'alert' | 'status' }> = {
  error: {
    ariaRole: 'alert',
    bg: 'bg-red-50',
    border: 'border-red-100',
    icon: AlertCircle,
    text: 'text-red-700',
  },
  success: {
    ariaRole: 'status',
    bg: 'bg-green-50',
    border: 'border-green-100',
    icon: CheckCircle2,
    text: 'text-green-700',
  },
  info: {
    ariaRole: 'status',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    icon: Info,
    text: 'text-blue-700',
  },
  warning: {
    ariaRole: 'alert',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    icon: AlertCircle,
    text: 'text-amber-700',
  },
}

export function StatusMessage({ variant, children, className = '', live = true }: StatusMessageProps) {
  const { ariaRole, bg, border, icon: Icon, text } = variantStyles[variant]

  return (
    <div
      role={ariaRole}
      aria-live={live ? (ariaRole === 'alert' ? 'assertive' : 'polite') : undefined}
      className={`rounded-lg border px-3 py-2.5 text-sm ${bg} ${border} ${text} ${className}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

export function InlineStatus({ loading, text }: { loading?: boolean; text?: string }) {
  if (!loading && !text) return null

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      <span>{text}</span>
    </div>
  )
}

export { Loader2 }
