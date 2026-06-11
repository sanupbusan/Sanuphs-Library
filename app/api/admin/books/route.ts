import { NextResponse } from 'next/server'
import { adminAuthErrorResponse, requireAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession(request)
    const { data, error } = await session.supabase
      .from('books')
      .select('id, isbn, title, author, publisher, category, total_copies, available_copies, location, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    return NextResponse.json({
      data: data ?? [],
    })
  } catch (error) {
    return adminAuthErrorResponse(error)
  }
}
