'use client'

import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Library,
  ClipboardList,
  AlertCircle,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type DashboardSection = 'dashboard' | 'books' | 'overdue' | 'statistics'

type SidebarMenuItem = {
  href?: string
  icon: LucideIcon
  label: string
  section: DashboardSection | null
}

const sidebarMenuItems: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: '대시보드', section: 'dashboard' },
  { icon: Library, label: '도서 관리', section: 'books' },
  { icon: ClipboardList, label: '대여 관리', href: '/admin/loans', section: null },
  { icon: AlertCircle, label: '연체 관리', section: 'overdue' },
  { icon: BarChart3, label: '통계', section: 'statistics' },
]

type DashboardSidebarProps = {
  activeSection: DashboardSection
  onSectionChange: (section: DashboardSection) => void
}

export function DashboardSidebar({ activeSection, onSectionChange }: DashboardSidebarProps) {
  const router = useRouter()

  return (
    <div className="flex w-40 flex-shrink-0 flex-col bg-primary-700 py-4">
      <div className="mb-6 flex items-center px-4">
        <img src="/logo.png" alt="SanupHs Library" className="h-5 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {sidebarMenuItems.map((item) => {
          const isActive = item.section === activeSection

          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (item.href) {
                  router.push(item.href)
                } else if (item.section) {
                  onSectionChange(item.section)
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white',
                !item.section && !item.href && 'cursor-default text-white/45 hover:bg-transparent hover:text-white/45'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
