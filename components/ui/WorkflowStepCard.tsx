import { type ReactNode } from 'react'
import { Check, Loader2, Lock } from 'lucide-react'

type WorkflowStepState = 'current' | 'complete' | 'locked' | 'error'

type WorkflowStepCardProps = {
  step: number
  title: string
  description?: string
  state?: WorkflowStepState
  children: ReactNode
  action?: ReactNode
}

const stateStyles: Record<WorkflowStepState, { border: string; iconBg: string; iconText: string }> = {
  current: {
    border: 'border-primary-200 bg-white',
    iconBg: 'bg-primary-600',
    iconText: 'text-white',
  },
  complete: {
    border: 'border-green-200 bg-green-50/30',
    iconBg: 'bg-green-600',
    iconText: 'text-white',
  },
  locked: {
    border: 'border-gray-200 bg-gray-50/50',
    iconBg: 'bg-gray-300',
    iconText: 'text-white',
  },
  error: {
    border: 'border-red-200 bg-white',
    iconBg: 'bg-red-600',
    iconText: 'text-white',
  },
}

function StepIcon({ state, step }: { state: WorkflowStepState; step: number }) {
  const { iconBg, iconText } = stateStyles[state]
  const content =
    state === 'complete' ? (
      <Check className="h-4 w-4" />
    ) : state === 'locked' ? (
      <Lock className="h-3 w-3" />
    ) : (
      step
    )

  return (
    <div
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${iconBg} ${iconText}`}
    >
      {content}
    </div>
  )
}

export function WorkflowStepCard({
  step,
  title,
  description,
  state = 'current',
  children,
  action,
}: WorkflowStepCardProps) {
  const { border } = stateStyles[state]
  const isDimmed = state === 'locked'

  return (
    <div
      className={`rounded-lg border p-5 shadow-sm transition-opacity ${border} ${isDimmed ? 'opacity-70' : ''}`}
      aria-current={state === 'current' ? 'step' : undefined}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StepIcon state={state} step={step} />
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description ? <p className="text-sm text-gray-500">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function WorkflowStepCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-3 w-40 rounded bg-gray-200" />
        </div>
      </div>
      <div className="h-11 w-full rounded-lg bg-gray-200" />
    </div>
  )
}

export { Loader2 }
