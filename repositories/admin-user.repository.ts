import { eq } from 'drizzle-orm'
import { adminUsers } from '@/db/schema'
import type { DbClient } from '@/lib/db'

export type AdminUserCredentials = {
  user_id: string
  login_id: string
  password_hash: string
  role: 'admin'
}

export async function findAdminUserByLoginId(
  db: DbClient,
  loginId: string
): Promise<AdminUserCredentials | null> {
  const rows = await db
    .select({
      user_id: adminUsers.user_id,
      login_id: adminUsers.login_id,
      password_hash: adminUsers.password_hash,
      role: adminUsers.role,
    })
    .from(adminUsers)
    .where(eq(adminUsers.login_id, loginId))
    .limit(1)

  return rows[0] ?? null
}
