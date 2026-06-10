'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface HeaderProps {
  className?: string
}

const navigationItems = [
  { label: '도서검색', href: '/books' },
  { label: '대여관리', href: '/#rental' },
  { label: '기능소개', href: '/#features' },
]

export default function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md',
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
          <img src="/logo.png" alt="SanupHs Library" className="h-8 w-auto" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
