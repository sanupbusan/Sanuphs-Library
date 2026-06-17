import { NextResponse } from 'next/server'
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  isSupabaseConfigured,
  type TypedSupabaseClient,
} from '@/lib/supabase'
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
import type { Database } from '@/types/supabase'

export { ADMIN_ACCESS_TOKEN_COOKIE, AdminAuthError } from '@/lib/admin-auth-shared'

type AdminRole = Database['public']['Enums']['admin_role']

export type AdminSession = {
  role: AdminRole
  supabase: TypedSupabaseClient
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
  await setAdminSessionSignedCookie(
    response,
    {
      role: serializedSession.role,
      user: serializedSession.user,
      exp: expiresAt ?? fallbackExp,
    },
    { maxAge: expiresIn }
  )
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
  if (!isSupabaseConfigured()) {
    throw new AdminAuthError(
      503,
      'SUPABASE_NOT_CONFIGURED',
      'Supabase 환경변수가 설정되지 않았습니다.'
    )
  }

  if (!accessToken) {
    throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }

  const cachedSession = getCachedAdminSession(accessToken)
  if (cachedSession) {
    return cachedSession
  }

  const authClient = createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken)

  if (userError || !user) {
    throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
  }

  const authedClient = createSupabaseClientWithAccessToken(accessToken)
  const { data: adminUser, error: adminUserError } = await authedClient
    .from('admin_users')
    .select('login_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminUserError) {
    throw adminUserError
  }

  if (!adminUser) {
    throw new AdminAuthError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
  }

  const session = {
    role: adminUser.role,
    supabase: authedClient,
    user: {
      id: user.id,
      loginId: adminUser.login_id,
    },
  }

  cacheAdminSession(accessToken, session)

  return session
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

  const authedClient = createSupabaseClientWithAccessToken(accessToken)
  const session: AdminSession = {
    role: signedSession.role as AdminRole,
    supabase: authedClient,
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
