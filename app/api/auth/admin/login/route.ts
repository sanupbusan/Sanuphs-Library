import {
  AdminAuthError,
  createAdminSession,
  getAdminSessionMaxAgeSeconds,
  serializeAdminSession,
  setAdminSessionCookie,
} from '@/lib/admin-auth'
import { isAdminCookieSecureEnabled } from '@/lib/admin-auth-shared'
import {
  createRouteDbClient,
  jsonData,
  readJsonBody,
  runApiRoute,
  withNoStore,
} from '@/lib/api-route'
import { authenticateAdmin } from '@/services/admin-auth.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEBUG_TAG = '[LOGIN_DEBUG_SERVER]'
const LOGIN_DEBUG_ENABLED = process.env.LOGIN_DEBUG === 'true'

function dbg(msg: string, data?: unknown) {
  if (!LOGIN_DEBUG_ENABLED) {
    return
  }

  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
}

type LoginBody = {
  loginId?: unknown
  password?: unknown
}

function hasAdminSessionSecret() {
  return Boolean(process.env.ADMIN_SESSION_SECRET?.trim())
}

function getCredentials(body: LoginBody) {
  const loginId = typeof body.loginId === 'string' ? body.loginId.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  return { loginId, password }
}

export async function POST(request: Request) {
  const t_start = Date.now()
  dbg('POST /api/auth/admin/login — HANDLER ENTERED', {
    method: request.method,
    url: request.url,
    hasCookie: request.headers.get('cookie') !== null,
    contentType: request.headers.get('content-type'),
  })

  try {
    return await runApiRoute(
      {
        fallback: {
          code: 'ADMIN_LOGIN_FAILED',
          message: '로그인에 실패했습니다.',
        },
        logLabel: 'Admin login error:',
      },
      async () => {
        dbg('POST: reading JSON body')
        const t0 = Date.now()
        const body = await readJsonBody<LoginBody>(request)
        dbg('POST: body parsed', { duration_ms: Date.now() - t0, keys: Object.keys(body) })

        const { loginId, password } = getCredentials(body)

        dbg('POST: credentials extracted', {
          hasLoginId: Boolean(loginId),
          hasPassword: Boolean(password),
          env_ADMIN_LOGIN_ID_set: Boolean(process.env.ADMIN_LOGIN_ID),
          env_ADMIN_SESSION_SECRET_set: Boolean(process.env.ADMIN_SESSION_SECRET),
          env_ADMIN_SESSION_SECRET_length: (process.env.ADMIN_SESSION_SECRET ?? '').length,
          env_ADMIN_COOKIE_SECURE: process.env.ADMIN_COOKIE_SECURE,
          env_DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
          cookieSecureEnabled: isAdminCookieSecureEnabled(),
          nodeEnv: process.env.NODE_ENV,
          platform: process.platform,
        })

        if (!loginId || !password) {
          dbg('POST: FAIL — missing credentials')
          throw new AdminAuthError(400, 'MISSING_CREDENTIALS', '아이디와 비밀번호를 입력해주세요.')
        }

        if (!hasAdminSessionSecret()) {
          dbg('POST: FAIL — ADMIN_SESSION_SECRET not set')
          throw new AdminAuthError(
            503,
            'ADMIN_SESSION_SECRET_NOT_CONFIGURED',
            'ADMIN_SESSION_SECRET is not configured.'
          )
        }

        const db = createRouteDbClient()
        dbg('POST: authenticating admin user')
        const authenticationStartedAt = Date.now()
        const adminUser = await authenticateAdmin(db, loginId, password)
        dbg('POST: admin authentication completed', {
          duration_ms: Date.now() - authenticationStartedAt,
        })

        dbg('POST: all checks passed, creating session')

        const t2 = Date.now()
        const adminSession = createAdminSession({
          id: adminUser.user_id,
          loginId: adminUser.login_id,
          role: adminUser.role,
        })
        const expiresIn = getAdminSessionMaxAgeSeconds()
        const expiresAt = Math.floor(Date.now() / 1000) + expiresIn

        dbg('POST: session object created', {
          duration_ms: Date.now() - t2,
          expiresIn,
        })

        const t3 = Date.now()
        const response = jsonData(serializeAdminSession(adminSession), withNoStore())

        dbg('POST: setting cookies on response')
        await setAdminSessionCookie(
          response,
          expiresIn,
          expiresAt,
          serializeAdminSession(adminSession)
        )
        dbg('POST: cookies set', {
          duration_ms: Date.now() - t3,
          cookieNames: ['bb_admin_session'],
        })

        dbg('POST: SUCCESS — returning response', { total_duration_ms: Date.now() - t_start })
        return response
      }
    )
  } catch (err) {
    dbg('POST: UNCAUGHT ERROR', { error: String(err), stack: (err as Error)?.stack, total_duration_ms: Date.now() - t_start })
    throw err
  }
}
