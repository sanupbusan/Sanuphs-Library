import { cn } from '@/lib/utils'
import type { DashboardStat } from '@/lib/dashboard-data'

export function StatCard({ icon: Icon, label, value, color }: DashboardStat) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-xs text-gray-500">{label}</p>
        <p className="whitespace-nowrap text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
