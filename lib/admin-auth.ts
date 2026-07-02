import { NextResponse } from 'next/server'
import { getDb, type DbClient } from '@/lib/db'
import { ApiRouteError, jsonError } from '@/lib/api-route'
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  AdminAuthError,
  getAdminCookieOptions,
  parseCookieHeader,
} from '@/lib/admin-auth-shared'
import {
  clearAdminSessionSignedCookie,
  getAdminSessionFromSignedCookie,
  setAdminSessionSignedCookie,
} from '@/lib/admin-session-cookie'

export { ADMIN_ACCESS_TOKEN_COOKIE, AdminAuthError } from '@/lib/admin-auth-shared'

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

type AdminSessionCacheEntry = {
  expiresAt: number
  session: AdminSession
}

const ADMIN_SESSION_CACHE_TTL_MS = 5 * 60 * 1000
const ADMIN_SESSION_CACHE_MAX_ENTRIES = 20
const DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60
const LOCAL_ADMIN_USER_ID = 'local-admin'
const adminSessionCache = new Map<string, AdminSessionCacheEntry>()

function getAccessTokenFromRequest(request: Request) {
  return parseCookieHeader(request.headers.get('cookie')).get(ADMIN_ACCESS_TOKEN_COOKIE) ?? ''
}

function getCachedAdminSession(accessToken: string) {
  const cached = adminSessionCache.get(accessToken)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    adminSessionCache.delete(accessToken)
    return null
  }

  return cached.session
}

export function getAdminSessionMaxAgeSeconds() {
  const configuredValue = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS)

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return Math.trunc(configuredValue)
  }

  return DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS
}

export function createAdminAccessToken() {
  return crypto.randomUUID()
}

export function createLocalAdminSession(loginId: string): AdminSession {
  return {
    db: getDb(),
    role: 'admin',
    user: {
      id: LOCAL_ADMIN_USER_ID,
      loginId,
    },
  }
}

export function cacheAdminSession(accessToken: string, session: AdminSession) {
  if (!accessToken) {
    return
  }

  adminSessionCache.set(accessToken, {
    expiresAt: Date.now() + ADMIN_SESSION_CACHE_TTL_MS,
    session,
  })

  if (adminSessionCache.size > ADMIN_SESSION_CACHE_MAX_ENTRIES) {
    const oldestKey = adminSessionCache.keys().next().value
    if (oldestKey) {
      adminSessionCache.delete(oldestKey)
    }
  }
}

export function clearAdminSessionCache(accessToken?: string) {
  if (accessToken) {
    adminSessionCache.delete(accessToken)
    return
  }

  adminSessionCache.clear()
}

export async function setAdminSessionCookie(
  response: NextResponse,
  accessToken: string,
  expiresIn: number,
  expiresAt: number | undefined,
  serializedSession: SerializedAdminSession
) {
  const cookieOptions = getAdminCookieOptions()
  response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: expiresIn,
  })

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
    response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, '', {
      ...cookieOptions,
      maxAge: 0,
    })

    throw new AdminAuthError(
      503,
      'ADMIN_SESSION_COOKIE_NOT_SET',
      'Admin session cookie could not be created.'
    )
  }
}

export function clearAdminSessionCookie(response: NextResponse) {
  const cookieOptions = getAdminCookieOptions()
  response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, '', {
    ...cookieOptions,
    maxAge: 0,
  })
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

export async function createAdminSessionFromAccessToken(accessToken: string): Promise<AdminSession> {
  if (!accessToken) {
    throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }

  const cachedSession = getCachedAdminSession(accessToken)
  if (cachedSession) {
    return cachedSession
  }

  throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
}

async function createAdminSessionFromSignedPayload(
  accessToken: string,
  request: Request
): Promise<AdminSession | null> {
  if (!accessToken) {
    return null
  }

  const signedSession = await getAdminSessionFromSignedCookie(request)
  if (!signedSession) {
    return null
  }

  const cachedSession = getCachedAdminSession(accessToken)
  if (cachedSession) {
    return cachedSession
  }

  const session: AdminSession = {
    db: getDb(),
    role: signedSession.role as AdminRole,
    user: signedSession.user,
  }

  cacheAdminSession(accessToken, session)
  return session
}

export async function requireAdminSession(request: Request): Promise<AdminSession> {
  const accessToken = getAccessTokenFromRequest(request)

  const signedSession = await createAdminSessionFromSignedPayload(accessToken, request)
  if (signedSession) {
    return signedSession
  }

  return createAdminSessionFromAccessToken(accessToken)
}
