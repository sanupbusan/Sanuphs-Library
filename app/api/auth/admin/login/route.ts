import {
  AdminAuthError,
  cacheAdminSession,
  createAdminAccessToken,
  createLocalAdminSession,
  getAdminSessionMaxAgeSeconds,
  serializeAdminSession,
  setAdminSessionCookie,
} from '@/lib/admin-auth'
import { isAdminCookieSecureEnabled } from '@/lib/admin-auth-shared'
import { jsonData, readJsonBody, runApiRoute, withNoStore } from '@/lib/api-route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type LoginBody = {
  loginId?: unknown
  password?: unknown
}

const DEFAULT_ADMIN_LOGIN_ID = 'SanupLib'

function getConfiguredAdminLoginId() {
  return process.env.ADMIN_LOGIN_ID?.trim() || DEFAULT_ADMIN_LOGIN_ID
}

function getConfiguredAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? ''
}

function hasAdminSessionSecret() {
  return Boolean(process.env.ADMIN_SESSION_SECRET?.trim())
}

function getCredentials(body: LoginBody) {
  const loginId = typeof body.loginId === 'string' ? body.loginId.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  return { loginId, password }
}

async function sha256(value: string) {
  const encodedValue = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', encodedValue)

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function isPasswordMatch(inputPassword: string, configuredPassword: string) {
  if (!configuredPassword) {
    console.error('[AdminAuth] Login blocked: ADMIN_PASSWORD is not configured.')
    throw new AdminAuthError(
      503,
      'ADMIN_PASSWORD_NOT_CONFIGURED',
      'ADMIN_PASSWORD가 설정되지 않았습니다.'
    )
  }

  const [inputHash, configuredHash] = await Promise.all([
    sha256(inputPassword),
    sha256(configuredPassword),
  ])

  return inputHash === configuredHash
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
      const configuredLoginId = getConfiguredAdminLoginId()

      console.info('[AdminAuth] Login attempt received.', {
        cookieSecure: isAdminCookieSecureEnabled(),
        hasLoginId: Boolean(loginId),
        hasPassword: Boolean(password),
        hasSessionSecret: hasAdminSessionSecret(),
        nodeEnv: process.env.NODE_ENV,
      })

      if (!loginId || !password) {
        throw new AdminAuthError(400, 'MISSING_CREDENTIALS', '아이디와 비밀번호를 입력해주세요.')
      }

      if (loginId !== configuredLoginId) {
        console.warn('[AdminAuth] Login rejected: invalid login id.', { loginId })
        throw new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
      }

      const passwordMatches = await isPasswordMatch(password, getConfiguredAdminPassword())
      if (!passwordMatches) {
        console.warn('[AdminAuth] Login rejected: invalid password.', { loginId })
        throw new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
      }

      if (!hasAdminSessionSecret()) {
        console.error('[AdminAuth] Login blocked: ADMIN_SESSION_SECRET is not configured.')
        throw new AdminAuthError(
          503,
          'ADMIN_SESSION_SECRET_NOT_CONFIGURED',
          'ADMIN_SESSION_SECRET is not configured.'
        )
      }

      const adminSession = createLocalAdminSession(loginId)
      const accessToken = createAdminAccessToken()
      const expiresIn = getAdminSessionMaxAgeSeconds()
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn

      cacheAdminSession(accessToken, adminSession)

      const response = jsonData(serializeAdminSession(adminSession), withNoStore())
      await setAdminSessionCookie(
        response,
        accessToken,
        expiresIn,
        expiresAt,
        serializeAdminSession(adminSession)
      )

      console.info('[AdminAuth] Login succeeded and admin session cookies were set.', {
        cookieSecure: isAdminCookieSecureEnabled(),
        loginId,
      })

      return response
    }
  )
}
