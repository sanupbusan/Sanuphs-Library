'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'

type LoginResponse = {
  error?: {
    code: string
    message: string
  }
}

type SessionResponse = {
  data?: {
    user?: {
      loginId?: string
    }
  } | null
}

function getSafeAdminRedirect(nextPath: string | null) {
  if (!nextPath) {
    return '/admin'
  }

  if (
    nextPath === '/admin/login' ||
    nextPath.startsWith('/admin/login/') ||
    nextPath.startsWith('/admin/login?')
  ) {
    return '/admin'
  }

  if (nextPath === '/admin' || nextPath.startsWith('/admin/') || nextPath.startsWith('/admin?')) {
    return nextPath
  }

  return '/admin'
}

export default function AdminLoginForm() {
  const searchParams = useSearchParams()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let didCancel = false

    async function redirectIfAlreadyLoggedIn() {
      try {
        const response = await fetch('/api/auth/admin/session?optional=1', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        const payload = (await response.json()) as SessionResponse

        if (!didCancel && response.ok && payload.data?.user?.loginId) {
          window.location.replace('/admin')
        }
      } catch {
        // Stay on the login page when the optional session check fails.
      }
    }

    void redirectIfAlreadyLoggedIn()

    return () => {
      didCancel = true
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!loginId.trim() || !password) {
      setErrorMessage('아이디와 비밀번호를 입력해주세요.')
      return
    }

    setIsLoading(true)
    let shouldResetLoading = true

    try {
      const response = await fetch('/api/auth/admin/login', {
        body: JSON.stringify({ loginId, password }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        method: 'POST',
      })
      const payload = (await response.json()) as LoginResponse

      if (!response.ok) {
        throw new Error(payload.error?.message ?? '로그인에 실패했습니다.')
      }

      shouldResetLoading = false
      window.location.replace(getSafeAdminRedirect(searchParams.get('next')))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.')
    } finally {
      if (shouldResetLoading) {
        setIsLoading(false)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
        <p className="mt-2 text-sm text-gray-600">등록된 계정으로 로그인하세요.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="admin-login-id" className="mb-2 block text-sm font-medium text-gray-700">
            아이디
          </label>
          <input
            id="admin-login-id"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            autoComplete="username"
            placeholder="SanupLib"
            type="text"
          />
        </div>

        <div>
          <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-gray-700">
            비밀번호
          </label>
          <input
            id="admin-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            autoComplete="current-password"
            placeholder="비밀번호"
            type="password"
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        className={cn(
          'mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700',
          isLoading && 'cursor-wait opacity-80'
        )}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        로그인
      </button>
    </form>
  )
}
