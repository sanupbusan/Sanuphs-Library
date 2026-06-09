import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type TypedSupabaseClient = SupabaseClient<Database>

export function createBrowserSupabaseClient(): TypedSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}
