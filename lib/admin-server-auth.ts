import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  AdminAuthError,
  createAdminSessionFromAccessToken,
  type AdminSession,
} from '@/lib/admin-auth'

function getAdminAccessTokenFromCookies() {
  return cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? ''
}

export async function requireAdminSessionFromCookies(): Promise<AdminSession> {
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
