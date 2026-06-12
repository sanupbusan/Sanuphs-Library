import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DashboardRefreshProps = {
  isRefreshing: boolean
  onRefresh: () => Promise<void> | void
}

export function DashboardRefreshButton({ isRefreshing, onRefresh }: DashboardRefreshProps) {
  return (
    <button
      type="button"
      aria-label="대시보드 데이터 새로고침"
      disabled={isRefreshing}
      onClick={() => {
        void onRefresh()
      }}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:border-primary-100 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RotateCcw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
      {isRefreshing ? '새로고침 중' : '새로고침'}
    </button>
  )
}
