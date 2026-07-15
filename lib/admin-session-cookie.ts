import { NextResponse } from 'next/server'
import {
  ADMIN_SIGNED_SESSION_COOKIE,
  getAdminCookieOptions,
  parseCookieHeader,
} from '@/lib/admin-auth-shared'

const DEBUG_TAG = '[LOGIN_DEBUG_COOKIE]'
const LOGIN_DEBUG_ENABLED = process.env.LOGIN_DEBUG === 'true'

function dbg(msg: string, data?: unknown) {
  if (!LOGIN_DEBUG_ENABLED) {
    return
  }

  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
}

export type SignedAdminSessionPayload = {
  role: string
  user: {
    id: string
    loginId: string
  }
  exp: number
  iat: number
}

type CookieValueOptions = {
  maxAge: number
}

const ONE_DAY_SECONDS = 24 * 60 * 60

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function base64UrlToString(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')

  return atob(padded)
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function signPayload(payload: string, secret: string): Promise<string | null> {
  try {
    const key = await importSigningKey(secret)
    const encoder = new TextEncoder()
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    return arrayBufferToBase64Url(signature)
  } catch {
    return null
  }
}

async function verifyPayload(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await importSigningKey(secret)
    const encoder = new TextEncoder()
    const signatureBytes = base64UrlToBytes(signature)
    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payload))
  } catch (error) {
    dbg('verifyPayload: Web Crypto verification failed', { error: String(error) })
    return false
  }
}

function getAdminSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET?.trim() || null
}

export function getAdminSessionFromSignedCookie(request: Request): Promise<SignedAdminSessionPayload | null> {
  const cookieHeader = request.headers.get('cookie')
  const cookieValue = parseCookieHeader(cookieHeader).get(ADMIN_SIGNED_SESSION_COOKIE)
  return getAdminSessionFromSignedCookieValue(cookieValue)
}

export async function getAdminSessionFromSignedCookieValue(
  cookieValue: string | null | undefined
): Promise<SignedAdminSessionPayload | null> {
  if (!cookieValue) {
    dbg('verify: no cookie value provided')
    return null
  }

  const secret = getAdminSessionSecret()
  if (!secret) {
    dbg('verify: ADMIN_SESSION_SECRET is not set in env — cookie cannot be verified')
    return null
  }

  dbg('verify: starting verification', {
    cookieValueLength: cookieValue.length,
    cookieValuePrefix: cookieValue.slice(0, 20) + '...',
    secretLength: secret.length,
  })

  const result = await verifyAdminSessionCookie(cookieValue, secret)
  dbg('verify: verification result', {
    valid: result !== null,
    role: result?.role,
    loginId: result?.user?.loginId,
    exp: result?.exp,
    expRemaining: result ? result.exp - Math.floor(Date.now() / 1000) : null,
  })

  return result
}

export async function verifyAdminSessionCookie(
  cookieValue: string,
  secret: string
): Promise<SignedAdminSessionPayload | null> {
  const parts = cookieValue.split('.')
  dbg('verifyAdminSessionCookie: splitting cookie', {
    partsCount: parts.length,
    expectedParts: 2,
    payloadLength: parts[0]?.length,
    signatureLength: parts[1]?.length,
  })

  if (parts.length !== 2) {
    dbg('verifyAdminSessionCookie: FAIL — parts length is not 2')
    return null
  }

  const [payloadBase64, signature] = parts
  if (!payloadBase64 || !signature) {
    dbg('verifyAdminSessionCookie: FAIL — empty payload or signature')
    return null
  }

  const t0 = Date.now()
  const isValid = await verifyPayload(payloadBase64, signature, secret)
  dbg('verifyAdminSessionCookie: signature check', {
    valid: isValid,
    duration_ms: Date.now() - t0,
  })
  if (!isValid) {
    dbg('verifyAdminSessionCookie: FAIL — HMAC signature does not match')
    return null
  }

  try {
    const payloadJson = base64UrlToString(payloadBase64)
    dbg('verifyAdminSessionCookie: payload decoded', { payloadJsonPreview: payloadJson.slice(0, 100) })
    const payload = JSON.parse(payloadJson) as SignedAdminSessionPayload

    const nowSeconds = Date.now() / 1000
    if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
      dbg('verifyAdminSessionCookie: FAIL — expired or invalid exp', {
        exp: payload?.exp,
        now: nowSeconds,
        expired: payload?.exp !== undefined && payload.exp <= nowSeconds,
      })
      return null
    }

    if (!payload.user?.id || !payload.user?.loginId || !payload.role) {
      dbg('verifyAdminSessionCookie: FAIL — missing required fields', {
        hasUserId: Boolean(payload.user?.id),
        hasLoginId: Boolean(payload.user?.loginId),
        hasRole: Boolean(payload.role),
      })
      return null
    }

    dbg('verifyAdminSessionCookie: SUCCESS — payload valid')
    return payload
  } catch (err) {
    dbg('verifyAdminSessionCookie: FAIL — JSON parse error', { error: String(err) })
    return null
  }
}

export async function signAdminSessionCookie(
  session: Omit<SignedAdminSessionPayload, 'iat'>
): Promise<string | null> {
  const t0 = Date.now()
  const secret = getAdminSessionSecret()
  dbg('signAdminSessionCookie: called', {
    hasSecret: Boolean(secret),
    secretLength: secret?.length,
    role: session.role,
    loginId: session.user?.loginId,
  })

  if (!secret) {
    dbg('signAdminSessionCookie: FAIL — no secret')
    return null
  }

  const payload: SignedAdminSessionPayload = {
    ...session,
    iat: Math.floor(Date.now() / 1000),
  }

  const payloadJson = JSON.stringify(payload)
  dbg('signAdminSessionCookie: payload JSON', { length: payloadJson.length })

  const payloadBase64 = btoa(payloadJson).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  dbg('signAdminSessionCookie: base64 encoded', { base64Length: payloadBase64.length })

  const t1 = Date.now()
  const signature = await signPayload(payloadBase64, secret)
  dbg('signAdminSessionCookie: signing done', {
    duration_ms: Date.now() - t1,
    hasSignature: Boolean(signature),
    signatureLength: signature?.length,
  })

  if (!signature) {
    dbg('signAdminSessionCookie: FAIL — signing returned null')
    return null
  }

  const result = `${payloadBase64}.${signature}`
  dbg('signAdminSessionCookie: SUCCESS', {
    totalLength: result.length,
    total_duration_ms: Date.now() - t0,
  })
  return result
}

export async function setAdminSessionSignedCookie(
  response: NextResponse,
  session: Omit<SignedAdminSessionPayload, 'iat'>,
  options: CookieValueOptions
) {
  const cookieValue = await signAdminSessionCookie(session)
  if (!cookieValue) {
    return false
  }

  const cookieOptions = getAdminCookieOptions()
  response.cookies.set(ADMIN_SIGNED_SESSION_COOKIE, cookieValue, {
    ...cookieOptions,
    maxAge: options.maxAge,
  })

  return true
}

export function clearAdminSessionSignedCookie(response: NextResponse) {
  const cookieOptions = getAdminCookieOptions()
  response.cookies.set(ADMIN_SIGNED_SESSION_COOKIE, '', {
    ...cookieOptions,
    maxAge: 0,
  })
}

export function getAdminSessionFallbackMaxAge(): number {
  return ONE_DAY_SECONDS
}
