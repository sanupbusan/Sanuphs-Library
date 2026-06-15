import type { TypedSupabaseClient } from '@/lib/supabase'
import type { OverdueLoanRow, OverdueLoanSelectRow } from '@/types/library'

export async function listAdminOverdueLoans(
  supabase: TypedSupabaseClient,
  today = new Date().toISOString().slice(0, 10)
): Promise<OverdueLoanRow[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('id, borrowed_on, due_on, books(title), students(name, student_number)')
    .eq('status', 'rented')
    .lt('due_on', today)
    .order('due_on', { ascending: true })
    .limit(100)

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as OverdueLoanSelectRow[]).map((loan) => ({
    bookTitle: loan.books?.title ?? null,
    borrowedOn: loan.borrowed_on,
    dueOn: loan.due_on,
    id: loan.id,
    studentName: loan.students?.name ?? null,
    studentNumber: loan.students?.student_number ?? null,
  }))
}
