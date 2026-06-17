import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  AdminAuthError,
  createAdminSessionFromAccessToken,
  type AdminSession,
} from '@/lib/admin-auth'
import { ADMIN_SIGNED_SESSION_COOKIE } from '@/lib/admin-auth-shared'
import { createSupabaseClientWithAccessToken } from '@/lib/supabase'
import { getAdminSessionFromSignedCookieValue } from '@/lib/admin-session-cookie'

function getAdminAccessTokenFromCookies() {
  return cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? ''
}

async function createAdminSessionFromCookies(): Promise<AdminSession | null> {
  const accessToken = getAdminAccessTokenFromCookies()
  if (!accessToken) {
    return null
  }

  const signedSessionValue = cookies().get(ADMIN_SIGNED_SESSION_COOKIE)?.value
  const signedSession = await getAdminSessionFromSignedCookieValue(signedSessionValue)
  if (signedSession) {
    return {
      role: signedSession.role as AdminSession['role'],
      supabase: createSupabaseClientWithAccessToken(accessToken),
      user: signedSession.user,
    }
  }

  return null
}

export async function requireAdminSessionFromCookies(): Promise<AdminSession> {
  const session = await createAdminSessionFromCookies()
  if (session) {
    return session
  }

  const accessToken = getAdminAccessTokenFromCookies()
  if (!accessToken) {
    throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }

  return createAdminSessionFromAccessToken(accessToken)
}

export async function requireAdminPageSession(): Promise<AdminSession> {
  try {
    return await requireAdminSessionFromCookies()
  } catch (error) {
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
