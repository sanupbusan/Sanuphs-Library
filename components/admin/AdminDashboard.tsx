'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, BookOpen, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import type { SerializedAdminSession } from '@/lib/admin-auth'

type AdminDashboardProps = {
  session: SerializedAdminSession
}

export default function AdminDashboard({ session }: AdminDashboardProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await fetch('/api/auth/admin/logout', {
        method: 'POST',
      })
    } finally {
      window.dispatchEvent(new Event('admin-session-changed'))
      router.replace('/admin/login')
      router.refresh()
    }
  }

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">관리 콘솔</h1>
            <p className="mt-2 text-sm text-gray-600">로그인된 세션에서만 보호 기능을 사용할 수 있습니다.</p>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            disabled={isLoggingOut}
            type="button"
          >
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            로그아웃
          </button>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">인증 완료</h2>
              <p className="text-sm text-gray-500">현재 세션은 보호 API를 호출할 수 있습니다.</p>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">아이디</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{session.user.loginId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">권한</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{session.role}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">사용자 ID</dt>
              <dd className="mt-1 break-all text-sm font-medium text-gray-900">{session.user.id}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/books"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <BookOpen className="h-4 w-4" />
              도서관리
            </Link>

            <Link
              href="/admin/overdue"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <AlertTriangle className="h-4 w-4" />
              연체관리
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
