import type { TypedSupabaseClient } from '@/lib/supabase'

export async function getDashboardSummary(client: TypedSupabaseClient) {
  const { data, error } = await client
    .from('dashboard_summary')
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getRecentLoans(client: TypedSupabaseClient) {
  const { data, error } = await client
    .from('dashboard_recent_loans')
    .select('*')
    .order('rental_date', { ascending: false })

  if (error) {
    throw error
  }

  return data
}

export async function searchBooks(client: TypedSupabaseClient, query: string) {
  const { data, error } = await client
    .rpc('search_books', { search_query: query })

  if (error) {
    throw error
  }

  return data
}
