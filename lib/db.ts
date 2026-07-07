import 'server-only'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool, types as pgTypes } from 'pg'
import * as schema from '@/db/schema'

export type DbClient = NodePgDatabase<typeof schema>
export type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0]

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
    dbClient = drizzle(getDbPool(), { schema })
  }

  return dbClient
}

export async function withTransaction<T>(
  callback: (client: DbTransaction) => Promise<T>
): Promise<T> {
  return getDb().transaction(callback)
}
