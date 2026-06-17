import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_SIGNED_SESSION_COOKIE,
  AdminAuthError,
  getAdminCookieOptions,
} from '@/lib/admin-auth-shared'
import { getAdminSessionFromSignedCookie } from '@/lib/admin-session-cookie'

const ADMIN_LOGIN_PATH = '/admin/login'
const missingSupabaseEnvMessage = 'Supabase 환경변수가 설정되지 않았습니다.'

type SupabaseAuthUser = {
  id?: string
}

function getSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AdminAuthError(503, 'SUPABASE_NOT_CONFIGURED', missingSupabaseEnvMessage)
  }

  try {
    new URL(supabaseUrl)
  } catch {
    throw new AdminAuthError(503, 'SUPABASE_NOT_CONFIGURED', 'NEXT_PUBLIC_SUPABASE_URL 값이 올바르지 않습니다.')
  }

  return {
    supabaseAnonKey,
    supabaseUrl,
  }
}

function isAdminApi(pathname: string) {
  return pathname.startsWith('/api/admin')
}

function isAdminLoginPage(pathname: string) {
  return pathname === ADMIN_LOGIN_PATH
}

function getLoginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone()
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

  url.pathname = ADMIN_LOGIN_PATH
  url.search = ''

  if (nextPath !== ADMIN_LOGIN_PATH) {
    url.searchParams.set('next', nextPath)
  }

  return url
}

function clearAdminCookie(response: NextResponse) {
  const cookieOptions = getAdminCookieOptions()
  response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, '', {
    ...cookieOptions,
    maxAge: 0,
  })
  response.cookies.set(ADMIN_SIGNED_SESSION_COOKIE, '', {
    ...cookieOptions,
    maxAge: 0,
  })
}

function jsonAuthError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    )
  }

  console.error('Admin middleware auth failed:', error)

  return NextResponse.json(
    {
      error: {
        code: 'ADMIN_AUTH_FAILED',
        message: '관리자 인증 확인에 실패했습니다.',
      },
    },
    { status: 500 }
  )
}

function shouldClearAdminCookie(error: unknown) {
  return error instanceof AdminAuthError && (error.status === 401 || error.status === 403)
}

async function validateAdminRequest(request: NextRequest) {
  const signedSession = await getAdminSessionFromSignedCookie(request)
  if (signedSession) {
    const accessToken = request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? ''
    if (accessToken) {
      return
    }
  }

  const accessToken = request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? ''

  if (!accessToken) {
    throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }

  const { supabaseAnonKey, supabaseUrl } = getSupabasePublicEnv()
  const authResponse = await fetch(new URL('/auth/v1/user', supabaseUrl), {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (authResponse.status === 401 || authResponse.status === 403) {
    throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
  }

  if (!authResponse.ok) {
    throw new Error(`Supabase auth check failed with status ${authResponse.status}`)
  }

  const user = (await authResponse.json()) as SupabaseAuthUser

  if (!user.id) {
    throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
  }

  const adminUsersUrl = new URL('/rest/v1/admin_users', supabaseUrl)
  adminUsersUrl.searchParams.set('select', 'login_id,role')
  adminUsersUrl.searchParams.set('user_id', `eq.${user.id}`)
  adminUsersUrl.searchParams.set('limit', '1')

  const adminResponse = await fetch(adminUsersUrl, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (adminResponse.status === 401 || adminResponse.status === 403) {
    throw new AdminAuthError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
  }

  if (!adminResponse.ok) {
    throw new Error(`Supabase admin check failed with status ${adminResponse.status}`)
  }

  const adminUsers = (await adminResponse.json()) as unknown[]

  if (adminUsers.length === 0) {
    throw new AdminAuthError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isAdminApi(pathname)) {
    try {
      await validateAdminRequest(request)
      return NextResponse.next()
    } catch (error) {
      const response = jsonAuthError(error)

      if (shouldClearAdminCookie(error)) {
        clearAdminCookie(response)
      }

      return response
    }
  }

  if (isAdminLoginPage(pathname)) {
    try {
      await validateAdminRequest(request)
      return NextResponse.redirect(new URL('/admin', request.url))
    } catch (error) {
      const response = NextResponse.next()

      if (shouldClearAdminCookie(error)) {
        clearAdminCookie(response)
      }

      return response
    }
  }

  try {
    await validateAdminRequest(request)
    return NextResponse.next()
  } catch (error) {
    const response = NextResponse.redirect(getLoginRedirect(request))

    if (shouldClearAdminCookie(error)) {
      clearAdminCookie(response)
    }

    return response
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
