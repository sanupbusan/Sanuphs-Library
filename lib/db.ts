import 'server-only'

import { Pool, types as pgTypes, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

export type DbClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>
}

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/library'

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

export function getDbPool() {
  if (!pool) {
    const { databaseUrl } = assertPostgresEnv()
    pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: getSslConfig(),
    })

    pool.on('error', () => undefined)
  }

  return pool
}

export function getDb(): DbClient {
  if (!dbClient) {
    dbClient = {
      query: (text, params) => getDbPool().query(text, params),
    }
  }

  return dbClient
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getDbPool().query<T>(text, params)
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDbPool().connect()

  try {
    await client.query('begin')
    const result = await callback(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
