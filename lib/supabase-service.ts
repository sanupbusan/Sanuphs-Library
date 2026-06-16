import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { assertSupabasePublicEnv, type TypedSupabaseClient } from '@/lib/supabase'

const SUPABASE_FETCH_TIMEOUT_MS = 8_000

function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Supabase request timed out after ${timeoutMs}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
}

export function isSupabaseServiceRoleConfigured() {
  return Boolean(getSupabaseServiceRoleKey())
}

export function createServiceRoleSupabaseClient(): TypedSupabaseClient {
  const { supabaseUrl } = assertSupabasePublicEnv()
  const serviceRoleKey = getSupabaseServiceRoleKey()

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: createFetchWithTimeout(SUPABASE_FETCH_TIMEOUT_MS),
    },
  })
}
