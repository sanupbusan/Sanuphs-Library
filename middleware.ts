import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_SIGNED_SESSION_COOKIE,
  AdminAuthError,
  getAdminCookieOptions,
} from '@/lib/admin-auth-shared'
import { getAdminSessionFromSignedCookie } from '@/lib/admin-session-cookie'

const ADMIN_LOGIN_PATH = '/admin/login'

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
  const accessToken = request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? ''

  if (!accessToken) {
    throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }

  const signedSession = await getAdminSessionFromSignedCookie(request)
  if (!signedSession) {
    throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
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
