'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut, ShieldCheck } from 'lucide-react'

type AdminSessionResponse = {
  data?: {
    role: string
    user: {
      id: string
      loginId: string
    }
  }
  error?: {
    code: string
    message: string
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSessionResponse['data'] | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    let didCancel = false

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/admin/session')
        const payload = (await response.json()) as AdminSessionResponse

        if (didCancel) {
          return
        }

        if (response.status === 401 || response.status === 403) {
          router.replace('/admin/login')
          return
        }

        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? '관리자 세션 확인에 실패했습니다.')
        }

        setSession(payload.data)
      } catch (error) {
        if (!didCancel) {
          setErrorMessage(error instanceof Error ? error.message : '관리자 세션 확인에 실패했습니다.')
        }
      } finally {
        if (!didCancel) {
          setIsLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      didCancel = true
    }
  }, [router])

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await fetch('/api/auth/admin/logout', {
        method: 'POST',
      })
    } finally {
      router.replace('/admin/login')
      router.refresh()
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">관리자 콘솔</h1>
            <p className="mt-2 text-sm text-gray-600">관리 기능은 관리자 권한이 확인된 세션에서만 사용할 수 있습니다.</p>
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

        {errorMessage ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">관리자 인증 완료</h2>
                <p className="text-sm text-gray-500">현재 세션은 보호 API를 호출할 수 있습니다.</p>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">아이디</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{session?.user.loginId || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">권한</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{session?.role || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">사용자 ID</dt>
                <dd className="mt-1 break-all text-sm font-medium text-gray-900">{session?.user.id || '-'}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}
