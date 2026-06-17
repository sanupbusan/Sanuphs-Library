import {
  AdminAuthError,
  cacheAdminSession,
  serializeAdminSession,
  setAdminSessionCookie,
} from '@/lib/admin-auth'
import { createRouteSupabaseClient, jsonData, readJsonBody, runApiRoute } from '@/lib/api-route'
import { createSupabaseClientWithAccessToken } from '@/lib/supabase'

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
  return runApiRoute(
    {
      fallback: {
        code: 'ADMIN_LOGIN_FAILED',
        message: '로그인에 실패했습니다.',
      },
      logLabel: 'Admin login error:',
    },
    async () => {
      const body = await readJsonBody<LoginBody>(request)
      const { loginId, password } = getCredentials(body)

      if (!loginId || !password) {
        throw new AdminAuthError(400, 'MISSING_CREDENTIALS', '아이디와 비밀번호를 입력해주세요.')
      }

      if (loginId !== getConfiguredAdminLoginId()) {
        throw new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
      }

      const authClient = createRouteSupabaseClient()
      const { data, error } = await authClient.auth.signInWithPassword({
        email: getConfiguredAdminAuthEmail(),
        password,
      })

      if (error || !data.session || !data.user) {
        throw new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
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
        throw new AdminAuthError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
      }

      const adminSession = {
        role: adminUser.role,
        supabase: authedClient,
        user: {
          id: data.user.id,
          loginId: adminUser.login_id,
        },
      }

      cacheAdminSession(data.session.access_token, adminSession)

      const response = jsonData(serializeAdminSession(adminSession))
      setAdminSessionCookie(response, data.session)

      return response
    }
  )
}
