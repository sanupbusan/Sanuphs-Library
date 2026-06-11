import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type TypedSupabaseClient = SupabaseClient<Database>

type SupabasePublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

const missingSupabaseEnvMessage =
  'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'

let browserSupabaseClient: TypedSupabaseClient | null = null

function cleanEnvValue(value: string | undefined) {
  return value?.trim() ?? ''
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const supabaseUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  }
}

export function isSupabaseConfigured() {
  return getSupabasePublicEnv() !== null
}

export function assertSupabasePublicEnv(): SupabasePublicEnv {
  const supabaseEnv = getSupabasePublicEnv()

  if (!supabaseEnv) {
    throw new Error(missingSupabaseEnvMessage)
  }

  try {
    new URL(supabaseEnv.supabaseUrl)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL.')
  }

  return supabaseEnv
}

export function createBrowserSupabaseClient(): TypedSupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = assertSupabasePublicEnv()
  const isBrowser = typeof window !== 'undefined'

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
    },
  })
}

export function createServerSupabaseClient(): TypedSupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = assertSupabasePublicEnv()

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function createSupabaseClientWithAccessToken(accessToken: string): TypedSupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = assertSupabasePublicEnv()

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

export function getBrowserSupabaseClient(): TypedSupabaseClient {
  if (!browserSupabaseClient) {
    browserSupabaseClient = createBrowserSupabaseClient()
  }

  return browserSupabaseClient
}
