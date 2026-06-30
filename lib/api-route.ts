import { NextResponse } from 'next/server'
import { getDb, isPostgresConfigured, type DbClient } from '@/lib/db'

type ApiRouteFallback = {
  code: string
  message: string
  status?: number
}

type ApiRouteOptions = {
  exposeErrorMessage?: boolean
  fallback: ApiRouteFallback
  logLabel: string
}

export class ApiRouteError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiRouteError'
    this.code = code
    this.status = status
  }
}

function getStructuredApiError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'status' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.status === 'number'
  ) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    }
  }

  return null
}

export function jsonData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init)
}

export function jsonDataWithMeta<TData, TMeta>(
  data: TData,
  meta: TMeta,
  init?: ResponseInit
) {
  return NextResponse.json({ data, meta }, init)
}

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

export function withNoStore(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store, max-age=0')

  return {
    ...init,
    headers,
  }
}

export function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiRouteError(400, 'INVALID_JSON', '요청 본문은 올바른 JSON이어야 합니다.')
  }
}

export function throwApiError(status: number, code: string, message: string): never {
  throw new ApiRouteError(status, code, message)
}

export function createRouteDbClient(): DbClient {
  if (!isPostgresConfigured()) {
    throw new ApiRouteError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'PostgreSQL DATABASE_URL이 설정되지 않았습니다.'
    )
  }

  return getDb()
}

export function handleApiRouteError(error: unknown, options: ApiRouteOptions) {
  const structuredError = getStructuredApiError(error)

  if (structuredError) {
    return jsonError(structuredError.code, structuredError.message, structuredError.status)
  }

  console.error(options.logLabel, error)

  return jsonError(
    options.fallback.code,
    options.exposeErrorMessage && error instanceof Error ? error.message : options.fallback.message,
    options.fallback.status ?? 500
  )
}

export async function runApiRoute(
  options: ApiRouteOptions,
  handler: () => Promise<NextResponse>
) {
  try {
    return await handler()
  } catch (error) {
    return handleApiRouteError(error, options)
  }
}
