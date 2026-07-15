import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_SIGNED_SESSION_COOKIE,
  AdminAuthError,
  getAdminCookieOptions,
} from '@/lib/admin-auth-shared'
import { getAdminSessionFromSignedCookie } from '@/lib/admin-session-cookie'

const ADMIN_LOGIN_PATH = '/admin/login'

const DEBUG_TAG = '[LOGIN_DEBUG_MW]'
const LOGIN_DEBUG_ENABLED = process.env.LOGIN_DEBUG === 'true'

function dbg(msg: string, data?: unknown) {
  if (!LOGIN_DEBUG_ENABLED) {
    return
  }

  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
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
  const pathname = request.nextUrl.pathname
  const signedSessionRaw = request.cookies.get(ADMIN_SIGNED_SESSION_COOKIE)?.value ?? ''

  dbg(`validateAdminRequest for ${pathname}`, {
    hasSignedSessionCookie: Boolean(signedSessionRaw),
    signedSessionLength: signedSessionRaw.length,
    env_ADMIN_SESSION_SECRET_set: Boolean(process.env.ADMIN_SESSION_SECRET),
    env_ADMIN_SESSION_SECRET_length: (process.env.ADMIN_SESSION_SECRET ?? '').length,
    env_ADMIN_COOKIE_SECURE: process.env.ADMIN_COOKIE_SECURE,
  })

  const t0 = Date.now()
  const signedSession = await getAdminSessionFromSignedCookie(request)
  dbg(`MW cookie verification for ${pathname}`, {
    valid: signedSession !== null,
    duration_ms: Date.now() - t0,
    role: signedSession?.role,
    loginId: signedSession?.user?.loginId,
    exp: signedSession?.exp,
  })

  if (!signedSession) {
    dbg(`MW REJECT: ${pathname} — signed session cookie invalid or missing`)
    throw new AdminAuthError(401, 'INVALID_SESSION', '세션이 만료되었거나 올바르지 않습니다.')
  }

  dbg(`MW PASS: ${pathname}`)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  dbg(`middleware invoked for ${pathname}`)

  if (isAdminApi(pathname)) {
    dbg(`MW route type: admin API (${pathname})`)
    try {
      await validateAdminRequest(request)
      dbg(`MW: admin API pass ${pathname}`)
      return NextResponse.next()
    } catch (error) {
      dbg(`MW: admin API reject ${pathname}`, { code: (error as AdminAuthError)?.code, status: (error as AdminAuthError)?.status })
      const response = jsonAuthError(error)

      if (shouldClearAdminCookie(error)) {
        clearAdminCookie(response)
      }

      return response
    }
  }

  if (isAdminLoginPage(pathname)) {
    dbg(`MW route type: login page (${pathname}) — pass-through`)
    return NextResponse.next()
  }

  dbg(`MW route type: admin page (${pathname}) — validating`)
  try {
    await validateAdminRequest(request)
    dbg(`MW: admin page pass ${pathname}`)
    return NextResponse.next()
  } catch (error) {
    dbg(`MW: admin page reject ${pathname}`, { code: (error as AdminAuthError)?.code, status: (error as AdminAuthError)?.status })
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
