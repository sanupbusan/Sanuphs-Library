export type AdminCookieOptions = {
  httpOnly: boolean
  path: string
  sameSite: 'lax' | 'strict' | 'none'
  secure: boolean
}

export const ADMIN_ACCESS_TOKEN_COOKIE = 'bb_admin_access_token'
export const ADMIN_SIGNED_SESSION_COOKIE = 'bb_admin_session'

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

export function getAdminCookieOptions(): AdminCookieOptions {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }
}

export function parseCookieHeader(cookieHeader: string | null) {
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
