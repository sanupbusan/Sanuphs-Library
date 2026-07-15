import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminAuthError, createAdminSession, type AdminSession } from '@/lib/admin-auth'
import { ADMIN_SIGNED_SESSION_COOKIE } from '@/lib/admin-auth-shared'
import { getAdminSessionFromSignedCookieValue } from '@/lib/admin-session-cookie'

const DEBUG_TAG = '[LOGIN_DEBUG_SSR]'
const LOGIN_DEBUG_ENABLED = process.env.LOGIN_DEBUG === 'true'

function dbg(msg: string, data?: unknown) {
  if (!LOGIN_DEBUG_ENABLED) {
    return
  }

  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
}

async function createAdminSessionFromCookies(): Promise<AdminSession | null> {
  const signedSessionValue = cookies().get(ADMIN_SIGNED_SESSION_COOKIE)?.value

  dbg('createAdminSessionFromCookies: checking cookies', {
    hasSignedSessionCookie: Boolean(signedSessionValue),
    signedSessionLength: signedSessionValue?.length ?? 0,
  })

  const signedSession = await getAdminSessionFromSignedCookieValue(signedSessionValue)
  if (signedSession) {
    dbg('createAdminSessionFromCookies: session created from signed cookie', {
      role: signedSession.role,
      loginId: signedSession.user.loginId,
    })
    return createAdminSession({
      id: signedSession.user.id,
      loginId: signedSession.user.loginId,
      role: signedSession.role as AdminSession['role'],
    })
  }

  dbg('createAdminSessionFromCookies: signed session invalid or missing')
  return null
}

export async function requireAdminSessionFromCookies(): Promise<AdminSession> {
  const session = await createAdminSessionFromCookies()
  if (session) {
    return session
  }

  throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
}

export async function requireAdminPageSession(): Promise<AdminSession> {
  dbg('requireAdminPageSession: ENTERED')
  try {
    const session = await requireAdminSessionFromCookies()
    dbg('requireAdminPageSession: SUCCESS — session found', {
      role: session.role,
      loginId: session.user.loginId,
    })
    return session
  } catch (error) {
    dbg('requireAdminPageSession: FAILED', {
      code: (error as AdminAuthError)?.code,
      status: (error as AdminAuthError)?.status,
      willRedirect: error instanceof AdminAuthError && (error.status === 401 || error.status === 403),
    })
    if (error instanceof AdminAuthError && (error.status === 401 || error.status === 403)) {
      redirect('/admin/login')
    }

    throw error
  }
}

export async function getOptionalAdminSessionFromCookies(): Promise<AdminSession | null> {
  try {
    return await requireAdminSessionFromCookies()
  } catch (error) {
    if (error instanceof AdminAuthError && (error.status === 401 || error.status === 403)) {
      return null
    }

    throw error
  }
}
