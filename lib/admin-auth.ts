import { NextResponse } from 'next/server'
import type { Session } from '@supabase/supabase-js'
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  isSupabaseConfigured,
  type TypedSupabaseClient,
} from '@/lib/supabase'
import type { Database } from '@/types/supabase'

export const ADMIN_ACCESS_TOKEN_COOKIE = 'bb_admin_access_token'

type AdminRole = Database['public']['Enums']['admin_role']

export type AdminSession = {
  role: AdminRole
  supabase: TypedSupabaseClient
  user: {
    id: string
    loginId: string
  }
}

export class AdminAuthError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AdminAuthError'
    this.status = status
    this.code = code
  }
}

const cookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>()

  if (!cookieHeader) {
    return cookies
  }

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=')
    if (!rawName || rawValue.length === 0) {
      continue
    }

    cookies.set(rawName, decodeURIComponent(rawValue.join('=')))
  }

  return cookies
}

function getAccessTokenFromRequest(request: Request) {
  return parseCookieHeader(request.headers.get('cookie')).get(ADMIN_ACCESS_TOKEN_COOKIE) ?? ''
}

export function setAdminSessionCookie(response: NextResponse, session: Session) {
  response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, session.access_token, {
    ...cookieOptions,
    maxAge: session.expires_in,
  })
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, '', {
    ...cookieOptions,
    maxAge: 0,
  })
}

export function adminAuthErrorResponse(error: unknown) {
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

  console.error('Admin auth failed:', error)
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

export function serializeAdminSession(session: AdminSession) {
  return {
    role: session.role,
    user: session.user,
  }
}

export async function requireAdminSession(request: Request): Promise<AdminSession> {
  if (!isSupabaseConfigured()) {
    throw new AdminAuthError(
      503,
      'SUPABASE_NOT_CONFIGURED',
      'Supabase 환경변수가 설정되지 않았습니다.'
    )
  }

  const accessToken = getAccessTokenFromRequest(request)
  if (!accessToken) {
    throw new AdminAuthError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
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

  return {
    role: adminUser.role,
    supabase: authedClient,
    user: {
      id: user.id,
      loginId: adminUser.login_id,
    },
  }
}
