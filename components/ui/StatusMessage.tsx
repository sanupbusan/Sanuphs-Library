import { type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusVariant = 'error' | 'success' | 'info' | 'warning'

type StatusMessageProps = {
  variant: StatusVariant
  children: ReactNode
  className?: string
  contentClassName?: string
  iconClassName?: string
  live?: boolean
}

type StatusVariantStyle = {
  ariaRole: 'alert' | 'status'
  bg: string
  border: string
  icon: LucideIcon
  text: string
}

const variantStyles: Record<StatusVariant, StatusVariantStyle> = {
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

export function StatusMessage({
  variant,
  children,
  className,
  contentClassName,
  iconClassName,
  live = true,
}: StatusMessageProps) {
  const { ariaRole, bg, border, icon: Icon, text } = variantStyles[variant]

  return (
    <div
      role={ariaRole}
      aria-live={live ? (ariaRole === 'alert' ? 'assertive' : 'polite') : undefined}
      className={cn('rounded-lg border px-3 py-2.5 text-sm', bg, border, text, className)}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', iconClassName)} />
        <div className={cn('min-w-0', contentClassName)}>{children}</div>
      </div>
    </div>
  )
}
