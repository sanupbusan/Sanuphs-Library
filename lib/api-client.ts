import type { ApiResponse } from '@/types/library'

export class ApiClientError extends Error {
  code?: string
  status: number

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

export async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await readJsonResponse<ApiResponse<T>>(response)

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload.error?.message ?? fallbackMessage,
      payload.error?.code
    )
  }

  if (payload.data === undefined) {
    throw new ApiClientError(response.status, fallbackMessage)
  }

  return payload.data
}
