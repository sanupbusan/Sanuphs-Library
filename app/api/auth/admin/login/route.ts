import { NextResponse } from 'next/server'
import {
  AdminAuthError,
  adminAuthErrorResponse,
  serializeAdminSession,
  setAdminSessionCookie,
} from '@/lib/admin-auth'
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  isSupabaseConfigured,
} from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type LoginBody = {
  loginId?: unknown
  password?: unknown
}

const DEFAULT_ADMIN_LOGIN_ID = 'SanupLib'
const DEFAULT_ADMIN_AUTH_EMAIL = 'sanuplib-admin@sanuplib.local'

function getConfiguredAdminLoginId() {
  return process.env.ADMIN_LOGIN_ID?.trim() || DEFAULT_ADMIN_LOGIN_ID
}

function getConfiguredAdminAuthEmail() {
  return process.env.ADMIN_AUTH_EMAIL?.trim() || DEFAULT_ADMIN_AUTH_EMAIL
}

function getCredentials(body: LoginBody) {
  const loginId = typeof body.loginId === 'string' ? body.loginId.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  return { loginId, password }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return adminAuthErrorResponse(
      new AdminAuthError(
        503,
        'SUPABASE_NOT_CONFIGURED',
        'Supabase 환경변수가 설정되지 않았습니다.'
      )
    )
  }

  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return adminAuthErrorResponse(
      new AdminAuthError(400, 'INVALID_JSON', '요청 본문이 올바른 JSON이어야 합니다.')
    )
  }

  const { loginId, password } = getCredentials(body)
  if (!loginId || !password) {
    return adminAuthErrorResponse(
      new AdminAuthError(400, 'MISSING_CREDENTIALS', '아이디와 비밀번호를 입력해주세요.')
    )
  }

  if (loginId !== getConfiguredAdminLoginId()) {
    return adminAuthErrorResponse(
      new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
    )
  }

  try {
    const authClient = createServerSupabaseClient()
    const { data, error } = await authClient.auth.signInWithPassword({
      email: getConfiguredAdminAuthEmail(),
      password,
    })

    if (error || !data.session || !data.user) {
      return adminAuthErrorResponse(
        new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
      )
    }

    const authedClient = createSupabaseClientWithAccessToken(data.session.access_token)
    const { data: adminUser, error: adminUserError } = await authedClient
      .from('admin_users')
      .select('login_id, role')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (adminUserError) {
      throw adminUserError
    }

    if (!adminUser || adminUser.login_id !== loginId) {
      return adminAuthErrorResponse(
        new AdminAuthError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
      )
    }

    const response = NextResponse.json({
      data: serializeAdminSession({
        role: adminUser.role,
        supabase: authedClient,
        user: {
          id: data.user.id,
          loginId: adminUser.login_id,
        },
      }),
    })
    setAdminSessionCookie(response, data.session)

    return response
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
