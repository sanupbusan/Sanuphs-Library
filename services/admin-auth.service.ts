import bcrypt from 'bcryptjs'
import { AdminAuthError } from '@/lib/admin-auth-shared'
import type { DbClient } from '@/lib/db'
import {
  findAdminUserByLoginId,
  type AdminUserCredentials,
} from '@/repositories/admin-user.repository'

function getDatabaseErrorCode(error: unknown, depth = 0): string {
  if (depth > 3 || typeof error !== 'object' || error === null) {
    return ''
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code
  }

  return 'cause' in error ? getDatabaseErrorCode(error.cause, depth + 1) : ''
}

function mapAdminDatabaseError(error: unknown) {
  const code = getDatabaseErrorCode(error)

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

export async function authenticateAdmin(
  db: DbClient,
  loginId: string,
  password: string
): Promise<AdminUserCredentials> {
  let adminUser: AdminUserCredentials | null

  try {
    adminUser = await findAdminUserByLoginId(db, loginId)
  } catch (error) {
    throw mapAdminDatabaseError(error)
  }

  if (!adminUser || !(await bcrypt.compare(password, adminUser.password_hash))) {
    throw new AdminAuthError(
      401,
      'INVALID_CREDENTIALS',
      '아이디 또는 비밀번호가 올바르지 않습니다.'
    )
  }

  return adminUser
}
