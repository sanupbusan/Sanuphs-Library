import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

test('loan and return routes do not manually update books.available_copies', async () => {
  const routePaths = ['app/api/loans/route.ts', 'app/api/returns/loans/route.ts']

  for (const routePath of routePaths) {
    const source = await readProjectFile(routePath)

    assert.doesNotMatch(
      source,
      /\.from\('books'\)[\s\S]*?\.update\(\{\s*available_copies:/,
      `${routePath} should rely on the database trigger instead of directly mutating books.available_copies`
    )
  }
})

test('public return route uses RPCs instead of direct loan table access', async () => {
  const source = await readProjectFile('app/api/returns/loans/route.ts')

  assert.match(source, /\.rpc\([\s\S]*'get_returnable_loan_by_school_book_code'/)
  assert.match(source, /\.rpc\('return_loans_by_school_book_codes'/)
  assert.doesNotMatch(source, /\.from\('loans'\)/)
})

test('availability correction migration recomputes from total copies minus active rentals', async () => {
  const source = await readProjectFile('supabase/migrations/20260611143000_recompute_book_available_copies.sql')

  assert.match(source, /left join public\.loans/i)
  assert.match(source, /loans\.status = 'rented'/i)
  assert.match(source, /books\.total_copies - rented_counts\.rented_count/i)
  assert.doesNotMatch(source, /where exists/i)
})

test('public return function migration leaves availability updates to the trigger', async () => {
  const source = await readProjectFile('supabase/migrations/20260611144500_fix_public_return_function_to_use_trigger_only.sql')

  assert.match(source, /create or replace function public\.return_loans_by_school_book_codes/i)
  assert.match(source, /update public\.loans/i)
  assert.doesNotMatch(source, /update public\.books/i)
})

test('overdue return migration stores student loan ban through overdue days', async () => {
  const source = await readProjectFile('supabase/migrations/20260612010000_add_student_loan_bans.sql')

  assert.match(source, /add column if not exists loan_banned_until date/i)
  assert.match(source, /drop function if exists public\.return_loans_by_school_book_codes\(text\[\]\)/i)
  assert.match(source, /update public\.students/i)
  assert.match(source, /updated_loans\.returned_on - updated_loans\.due_on/i)
  assert.match(source, /new_loan_banned_until/i)
  assert.match(source, /loan_banned_until/i)
})

test('loan creation blocks overdue and currently banned students before inserting', async () => {
  const source = await readProjectFile('app/api/loans/route.ts')
  const insertIndex = source.indexOf('.insert({')

  assert.notEqual(insertIndex, -1, 'loan insert should exist')
  assert.match(source, /loan_banned_until/)
  assert.match(source, /STUDENT_LOAN_BANNED/)
  assert.match(source, /STUDENT_HAS_OVERDUE_LOAN/)
  assert.match(source, /\.lt\('due_on', today\)/)
  assert.ok(source.indexOf('STUDENT_LOAN_BANNED') < insertIndex, 'ban check must happen before loan insert')
  assert.ok(source.indexOf('STUDENT_HAS_OVERDUE_LOAN') < insertIndex, 'overdue check must happen before loan insert')
})

test('student barcode lookup exposes active overdue days in the rent form', async () => {
  const studentRouteSource = await readProjectFile('app/api/students/route.ts')
  const rentFormSource = await readProjectFile('components/rent/RentBookForm.tsx')

  assert.match(studentRouteSource, /\.eq\('status', 'rented'\)/)
  assert.match(studentRouteSource, /\.lt\('due_on', today\)/)
  assert.match(studentRouteSource, /loan_ban_remaining_days: loanBanRemainingDays/)
  assert.match(studentRouteSource, /overdue_days: overdueDays/)
  assert.match(rentFormSource, /loan_ban_remaining_days: number/)
  assert.match(rentFormSource, /overdue_days: number/)
  assert.match(rentFormSource, /연체된 학생입니다\.\s*\$\{targetStudent\.overdue_days\}일/)
  assert.match(rentFormSource, /대출 금지 기간입니다\.\s*\$\{targetStudent\.loan_ban_remaining_days\}일/)
  assert.match(rentFormSource, /student && !studentRestrictionMessage/)
})
