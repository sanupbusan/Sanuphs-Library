import 'server-only'

import { Pool, types as pgTypes, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

export type DbClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>
}

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/library'
const MAX_LOGGED_SQL_LENGTH = 220

let pool: Pool | null = null
let dbClient: DbClient | null = null

pgTypes.setTypeParser(1082, String)
pgTypes.setTypeParser(1114, String)
pgTypes.setTypeParser(1184, String)

function cleanEnvValue(value: string | undefined) {
  return value?.trim() ?? ''
}

export function getDatabaseUrl() {
  return cleanEnvValue(process.env.DATABASE_URL || DEFAULT_DATABASE_URL)
}

export function isPostgresConfigured() {
  return Boolean(getDatabaseUrl())
}

export function assertPostgresEnv() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL.')
  }

  return { databaseUrl }
}

function getSslConfig() {
  const sslMode = cleanEnvValue(process.env.DATABASE_SSL).toLowerCase()

  if (sslMode === 'true' || sslMode === '1' || sslMode === 'require') {
    return {
      rejectUnauthorized: false,
    }
  }

  return undefined
}

function isDatabaseDebugEnabled() {
  const value = cleanEnvValue(process.env.DB_DEBUG).toLowerCase()

  if (!value) {
    return true
  }

  return !['0', 'false', 'off', 'no'].includes(value)
}

function getDatabaseTarget(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl)
    const user = url.username || 'unknown-user'
    const database = url.pathname.replace(/^\//, '') || 'unknown-database'
    const port = url.port || '5432'

    return `${user}@${url.hostname}:${port}/${database}`
  } catch {
    return 'invalid DATABASE_URL'
  }
}

function getLoggedSql(text: string) {
  const normalizedSql = text.replace(/\s+/g, ' ').trim()

  if (normalizedSql.length <= MAX_LOGGED_SQL_LENGTH) {
    return normalizedSql
  }

  return `${normalizedSql.slice(0, MAX_LOGGED_SQL_LENGTH)}...`
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    const errorCode = (error as Error & { code?: unknown }).code

    return {
      message: error.message,
      code: typeof errorCode === 'string' ? errorCode : undefined,
    }
  }

  return {
    message: String(error),
    code: undefined,
  }
}

function logDatabaseDebug(message: string, details?: Record<string, unknown>) {
  if (!isDatabaseDebugEnabled()) {
    return
  }

  if (details) {
    console.log(`[Database] ${message}`, details)
    return
  }

  console.log(`[Database] ${message}`)
}

async function runLoggedQuery<T extends QueryResultRow = QueryResultRow>(
  client: DbClient,
  text: string,
  params?: unknown[]
) {
  const startedAt = Date.now()
  const parameterCount = params?.length ?? 0

  logDatabaseDebug('Query started.', {
    sql: getLoggedSql(text),
    parameterCount,
  })

  try {
    const result = await client.query<T>(text, params)
    logDatabaseDebug('Query completed.', {
      durationMs: Date.now() - startedAt,
      rowCount: result.rowCount,
    })

    return result
  } catch (error) {
    logDatabaseDebug('Query failed.', {
      durationMs: Date.now() - startedAt,
      ...getErrorDetails(error),
    })
    throw error
  }
}

export function getDbPool() {
  if (!pool) {
    const { databaseUrl } = assertPostgresEnv()
    pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: getSslConfig(),
    })

    logDatabaseDebug('PostgreSQL pool initialized.', {
      target: getDatabaseTarget(databaseUrl),
      poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
    })

    pool.on('connect', () => {
      logDatabaseDebug('PostgreSQL client connected.')
    })

    pool.on('error', (error) => {
      logDatabaseDebug('PostgreSQL pool error.', getErrorDetails(error))
    })
  }

  return pool
}

export function getDb(): DbClient {
  if (!dbClient) {
    dbClient = {
      query: (text, params) => runLoggedQuery(getDbPool(), text, params),
    }
  }

  return dbClient
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return runLoggedQuery<T>(getDbPool(), text, params)
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const startedAt = Date.now()
  logDatabaseDebug('Transaction connection requested.')
  const client = await getDbPool().connect()

  try {
    logDatabaseDebug('Transaction started.')
    await client.query('begin')
    const result = await callback(client)
    await client.query('commit')
    logDatabaseDebug('Transaction committed.', {
      durationMs: Date.now() - startedAt,
    })
    return result
  } catch (error) {
    await client.query('rollback')
    logDatabaseDebug('Transaction rolled back.', {
      durationMs: Date.now() - startedAt,
      ...getErrorDetails(error),
    })
    throw error
  } finally {
    client.release()
    logDatabaseDebug('Transaction connection released.')
  }
}
