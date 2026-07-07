'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEBUG_TAG = '[LOGIN_DEBUG_CLIENT]'
function dbg(msg: string, data?: unknown) {
  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
}

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
      dbg('useEffect: session check starting')
      const t0 = performance.now()
      try {
        dbg('useEffect: sending GET /api/auth/admin/session?optional=1')
        const response = await fetch('/api/auth/admin/session?optional=1', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        dbg('useEffect: response received', {
          status: response.status,
          ok: response.ok,
          duration_ms: Math.round(performance.now() - t0),
        })
        const payload = (await response.json()) as SessionResponse
        dbg('useEffect: payload parsed', payload)

        if (!didCancel && response.ok && payload.data?.user?.loginId) {
          dbg('useEffect: already logged in, redirecting to /admin')
          window.location.replace('/admin')
        } else {
          dbg('useEffect: not logged in, staying on login page')
        }
      } catch (err) {
        dbg('useEffect: session check threw error', err)
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
      dbg('handleSubmit: missing credentials, aborting')
      setErrorMessage('아이디와 비밀번호를 입력해주세요.')
      return
    }

    dbg('handleSubmit: starting login', { loginId: loginId.trim() })
    setIsLoading(true)
    let shouldResetLoading = true

    try {
      dbg('handleSubmit: sending POST /api/auth/admin/login')
      const t0 = performance.now()
      const response = await fetch('/api/auth/admin/login', {
        body: JSON.stringify({ loginId, password }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        method: 'POST',
      })
      dbg('handleSubmit: response received', {
        status: response.status,
        ok: response.ok,
        duration_ms: Math.round(performance.now() - t0),
        hasSetCookie: response.headers.get('set-cookie') !== null,
      })

      dbg('handleSubmit: parsing JSON body')
      const payload = (await response.json()) as LoginResponse
      dbg('handleSubmit: payload parsed', payload)

      if (!response.ok) {
        dbg('handleSubmit: response not OK, throwing')
        throw new Error(payload.error?.message ?? '로그인에 실패했습니다.')
      }

      dbg('handleSubmit: login succeeded, redirecting')
      shouldResetLoading = false
      window.location.replace(getSafeAdminRedirect(searchParams.get('next')))
    } catch (error) {
      dbg('handleSubmit: caught error', error)
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.')
    } finally {
      dbg('handleSubmit: finally block', { shouldResetLoading })
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
