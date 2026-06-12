'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface HeaderProps {
  className?: string
}

type SessionResponse = {
  data?: {
    user: {
      loginId: string
    }
  }
}

const publicNavigationItems = [
  { label: '도서검색', href: '/books' },
  { label: '기능소개', href: '/#features' },
]

const protectedNavigationItems = [
  { label: '도서관리', href: '/admin/books' },
  { label: '연체관리', href: '/admin/overdue' },
]

export default function Header({ className }: HeaderProps) {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    let didCancel = false

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/admin/session?optional=1', {
          cache: 'no-store',
        })
        const payload = (await response.json()) as SessionResponse

        if (!didCancel) {
          setIsLoggedIn(response.ok && Boolean(payload.data?.user.loginId))
        }
      } catch {
        if (!didCancel) {
          setIsLoggedIn(false)
        }
      } finally {
        if (!didCancel) {
          setIsCheckingSession(false)
        }
      }
    }

    void checkSession()

    function handleSessionChange() {
      void checkSession()
    }

    window.addEventListener('admin-session-changed', handleSessionChange)

    return () => {
      didCancel = true
      window.removeEventListener('admin-session-changed', handleSessionChange)
    }
  }, [])

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await fetch('/api/auth/admin/logout', {
        method: 'POST',
      })
    } finally {
      setIsLoggedIn(false)
      setIsLoggingOut(false)
      window.dispatchEvent(new Event('admin-session-changed'))
      router.push('/admin/login')
      router.refresh()
    }
  }

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
          {publicNavigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
            >
              {item.label}
            </Link>
          ))}
          {isLoggedIn
            ? protectedNavigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
                >
                  {item.label}
                </Link>
              ))
            : null}
          {isLoggedIn ? (
            <button
              className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600 disabled:cursor-wait disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
              type="button"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/admin/login"
              className={cn(
                'text-sm font-medium text-gray-600 transition-colors hover:text-primary-600',
                isCheckingSession && 'opacity-60'
              )}
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
