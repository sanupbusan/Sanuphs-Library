import { NextResponse } from 'next/server'
import {
  ADMIN_SIGNED_SESSION_COOKIE,
  getAdminCookieOptions,
  parseCookieHeader,
} from '@/lib/admin-auth-shared'

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

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
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
    const signatureBuffer = base64UrlToArrayBuffer(signature)
    return crypto.subtle.verify('HMAC', key, signatureBuffer, encoder.encode(payload))
  } catch {
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
    return null
  }

  const secret = getAdminSessionSecret()
  if (!secret) {
    return null
  }

  return verifyAdminSessionCookie(cookieValue, secret)
}

export async function verifyAdminSessionCookie(
  cookieValue: string,
  secret: string
): Promise<SignedAdminSessionPayload | null> {
  const parts = cookieValue.split('.')
  if (parts.length !== 2) {
    return null
  }

  const [payloadBase64, signature] = parts
  if (!payloadBase64 || !signature) {
    return null
  }

  const isValid = await verifyPayload(payloadBase64, signature, secret)
  if (!isValid) {
    return null
  }

  try {
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson) as SignedAdminSessionPayload

    if (!payload || typeof payload.exp !== 'number' || payload.exp <= Date.now() / 1000) {
      return null
    }

    if (!payload.user?.id || !payload.user?.loginId || !payload.role) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export async function signAdminSessionCookie(
  session: Omit<SignedAdminSessionPayload, 'iat'>
): Promise<string | null> {
  const secret = getAdminSessionSecret()
  if (!secret) {
    return null
  }

  const payload: SignedAdminSessionPayload = {
    ...session,
    iat: Math.floor(Date.now() / 1000),
  }

  const payloadBase64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const signature = await signPayload(payloadBase64, secret)
  if (!signature) {
    return null
  }

  return `${payloadBase64}.${signature}`
}

export async function setAdminSessionSignedCookie(
  response: NextResponse,
  session: Omit<SignedAdminSessionPayload, 'iat'>,
  options: CookieValueOptions
) {
  const cookieValue = await signAdminSessionCookie(session)
  if (!cookieValue) {
    return
  }

  const cookieOptions = getAdminCookieOptions()
  response.cookies.set(ADMIN_SIGNED_SESSION_COOKIE, cookieValue, {
    ...cookieOptions,
    maxAge: options.maxAge,
  })
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
