import { NextResponse } from 'next/server'
import { getDb, type DbClient } from '@/lib/db'
import { ApiRouteError, jsonError } from '@/lib/api-route'
import { AdminAuthError } from '@/lib/admin-auth-shared'
import {
  clearAdminSessionSignedCookie,
  getAdminSessionFromSignedCookie,
  setAdminSessionSignedCookie,
} from '@/lib/admin-session-cookie'

export { AdminAuthError } from '@/lib/admin-auth-shared'

export type AdminRole = 'admin'

export type AdminSession = {
  db: DbClient
  role: AdminRole
  user: {
    id: string
    loginId: string
  }
}

export type SerializedAdminSession = {
  role: AdminRole
  user: AdminSession['user']
}

const DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60

export function getAdminSessionMaxAgeSeconds() {
  const configuredValue = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS)

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return Math.trunc(configuredValue)
  }

  return DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS
}

export function createAdminSession(user: AdminSession['user'] & { role?: AdminRole }): AdminSession {
  return {
    db: getDb(),
    role: user.role ?? 'admin',
    user: {
      id: user.id,
      loginId: user.loginId,
    },
  }
}

export async function setAdminSessionCookie(
  response: NextResponse,
  expiresIn: number,
  expiresAt: number | undefined,
  serializedSession: SerializedAdminSession
) {
  const fallbackExp = Math.floor(Date.now() / 1000) + expiresIn
  const signedSessionCookieWasSet = await setAdminSessionSignedCookie(
    response,
    {
      role: serializedSession.role,
      user: serializedSession.user,
      exp: expiresAt ?? fallbackExp,
    },
    { maxAge: expiresIn }
  )

  if (!signedSessionCookieWasSet) {
    throw new AdminAuthError(
      503,
      'ADMIN_SESSION_COOKIE_NOT_SET',
      'Admin session cookie could not be created.'
    )
  }
}

export function clearAdminSessionCookie(response: NextResponse) {
  clearAdminSessionSignedCookie(response)
}

export function adminAuthErrorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return jsonError(error.code, error.message, error.status)
  }

  if (error instanceof ApiRouteError) {
    return jsonError(error.code, error.message, error.status)
  }

  console.error('Admin auth failed:', error)
  return jsonError('ADMIN_AUTH_FAILED', '관리자 인증 확인에 실패했습니다.', 500)
}

export function serializeAdminSession(session: AdminSession): SerializedAdminSession {
  return {
    role: session.role,
    user: session.user,
  }
}

async function createAdminSessionFromSignedPayload(request: Request): Promise<AdminSession | null> {
  const signedSession = await getAdminSessionFromSignedCookie(request)
  if (!signedSession) {
    return null
  }

  return createAdminSession({
    id: signedSession.user.id,
    loginId: signedSession.user.loginId,
    role: signedSession.role as AdminRole,
  })
}

export async function requireAdminSession(request: Request): Promise<AdminSession> {
  const signedSession = await createAdminSessionFromSignedPayload(request)
  if (signedSession) {
    return signedSession
  }

  throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
}
