import type { TypedSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

export type DashboardSummary = Database['public']['Views']['dashboard_summary']['Row']
export type RecentLoan = Database['public']['Views']['dashboard_recent_loans']['Row']
export type SearchBook = Database['public']['Functions']['search_books']['Returns'][number]

export type DashboardData = {
  summary: DashboardSummary
  recentLoans: RecentLoan[]
}

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

export async function getRecentLoans(client: TypedSupabaseClient, limit = 5) {
  const { data, error } = await client
    .from('dashboard_recent_loans')
    .select('*')
    .order('rental_date', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data ?? []
}

export async function searchBooks(client: TypedSupabaseClient, query: string) {
  const { data, error } = await client
    .rpc('search_books', { search_query: query.trim() })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getDashboardData(client: TypedSupabaseClient): Promise<DashboardData> {
  const [summary, recentLoans] = await Promise.all([
    getDashboardSummary(client),
    getRecentLoans(client),
  ])

  return {
    summary,
    recentLoans,
  }
}
