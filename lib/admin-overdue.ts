import type { DbClient } from '@/lib/db'
import type { OverdueLoanRow } from '@/types/library'

export async function listAdminOverdueLoans(
  db: DbClient,
  today = new Date().toISOString().slice(0, 10)
): Promise<OverdueLoanRow[]> {
  const { rows } = await db.query<OverdueLoanRow>(
    `
      select
        loans.id,
        loans.borrowed_on as "borrowedOn",
        loans.due_on as "dueOn",
        books.title as "bookTitle",
        students.name as "studentName",
        students.student_number as "studentNumber"
      from public.loans
      left join public.books on books.id = loans.book_id
      left join public.students on students.id = loans.student_id
      where loans.status = 'rented'
        and loans.due_on < $1
      order by loans.due_on asc
      limit 100
    `,
    [today]
  )

  return rows
}
