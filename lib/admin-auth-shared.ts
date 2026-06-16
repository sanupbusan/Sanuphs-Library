export const ADMIN_ACCESS_TOKEN_COOKIE = 'bb_admin_access_token'

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
