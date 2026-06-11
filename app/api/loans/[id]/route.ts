import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const loanId = params.id

  if (!loanId) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_LOAN_ID',
          message: '대여 ID가 필요합니다.',
        },
      },
      { status: 400 }
    )
  }

  let body: { status?: unknown; dueOn?: unknown }

  try {
    body = (await request.json()) as { status?: unknown; dueOn?: unknown }
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_JSON',
          message: '요청 본문이 올바른 JSON이어야 합니다.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const updates: { due_on?: string; returned_on?: string | null; status?: 'rented' | 'returned' } = {}

    if (body.status === 'returned') {
      updates.status = 'returned'
      updates.returned_on = new Date().toISOString().slice(0, 10)
    } else if (body.status === 'rented') {
      updates.status = 'rented'
      updates.returned_on = null
    }

    const dueOnText = getText(body.dueOn)
    if (dueOnText) {
      updates.due_on = dueOnText
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_UPDATES',
            message: '변경할 내용이 없습니다.',
          },
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .select('id, status, due_on, returned_on')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'UPDATE_FAILED',
          message: '대여 상태 변경에 실패했습니다.',
        },
      },
      { status: 500 }
    )
  }
}
