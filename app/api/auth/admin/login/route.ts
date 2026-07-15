import bcrypt from 'bcryptjs'
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
import { findAdminUserByLoginId } from '@/repositories/admin-user.repository'

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

function getErrorCode(error: unknown, depth = 0): string {
  if (depth > 3) {
    return ''
  }

  if (typeof error !== 'object' || error === null || !('code' in error)) {
    if (typeof error === 'object' && error !== null && 'cause' in error) {
      return getErrorCode(error.cause, depth + 1)
    }

    return ''
  }

  if (typeof error.code === 'string') {
    return error.code
  }

  return 'cause' in error ? getErrorCode(error.cause, depth + 1) : ''
}

function getAdminDatabaseError(error: unknown) {
  const code = getErrorCode(error)

  if (code === '42P01' || code === '42703') {
    return new AdminAuthError(
      503,
      'ADMIN_DATABASE_SCHEMA_OUTDATED',
      '관리자 로그인 DB 스키마가 최신 상태가 아닙니다. 서버에서 관리자 로그인 DB 보정 SQL을 실행해주세요.'
    )
  }

  if (
    code === '28P01' ||
    code === '3D000' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT'
  ) {
    return new AdminAuthError(
      503,
      'ADMIN_DATABASE_UNAVAILABLE',
      'PostgreSQL에 연결할 수 없습니다. 서버의 DATABASE_URL과 PostgreSQL 실행 상태를 확인해주세요.'
    )
  }

  return error
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
        dbg('POST: loading admin user from DB')
        const tUser = Date.now()
        let adminUser

        try {
          adminUser = await findAdminUserByLoginId(db, loginId)
        } catch (error) {
          throw getAdminDatabaseError(error)
        }
        dbg('POST: admin user lookup done', {
          found: Boolean(adminUser),
          duration_ms: Date.now() - tUser,
        })

        if (!adminUser) {
          dbg('POST: FAIL — loginId not found', { loginId })
          throw new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
        }

        dbg('POST: checking bcrypt password')
        const t1 = Date.now()
        const passwordMatches = await bcrypt.compare(password, adminUser.password_hash)
        dbg('POST: password check done', { matches: passwordMatches, duration_ms: Date.now() - t1 })
        if (!passwordMatches) {
          dbg('POST: FAIL — password mismatch')
          throw new AdminAuthError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
        }

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
