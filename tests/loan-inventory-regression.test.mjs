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
  assert.match(source, /\.rpc\([\s\S]*'return_loans_by_school_book_codes'/)
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

test('public loan RPC blocks overdue and currently banned students before inserting', async () => {
  const migrationSource = await readProjectFile('supabase/migrations/20260612130000_enrich_public_loan_functions.sql')
  const routeSource = await readProjectFile('app/api/loans/route.ts')
  const insertIndex = migrationSource.toLowerCase().indexOf('insert into public.loans')

  assert.notEqual(insertIndex, -1, 'loan insert should exist')
  assert.match(migrationSource, /loan_banned_until/)
  assert.match(migrationSource, /STUDENT_LOAN_BANNED/)
  assert.match(migrationSource, /STUDENT_HAS_OVERDUE_LOAN/)
  assert.match(migrationSource, /loans\.due_on < v_today/)
  assert.ok(
    migrationSource.indexOf('STUDENT_LOAN_BANNED') < insertIndex,
    'ban check must happen before loan insert'
  )
  assert.ok(
    migrationSource.indexOf('STUDENT_HAS_OVERDUE_LOAN') < insertIndex,
    'overdue check must happen before loan insert'
  )
  assert.match(routeSource, /message\.startsWith\('STUDENT_LOAN_BANNED\|'\)/)
  assert.match(routeSource, /message\.startsWith\('STUDENT_HAS_OVERDUE_LOAN\|'\)/)
  assert.match(routeSource, /'STUDENT_LOAN_BANNED'/)
  assert.match(routeSource, /'STUDENT_HAS_OVERDUE_LOAN'/)
})

test('student barcode lookup exposes active overdue metadata to the rent flow', async () => {
  const studentRouteSource = await readProjectFile('app/api/students/route.ts')
  const migrationSource = await readProjectFile('supabase/migrations/20260612130000_enrich_public_loan_functions.sql')
  const typeSource = await readProjectFile('types/supabase.ts')

  assert.match(studentRouteSource, /\.rpc\('lookup_student_for_loan'/)
  assert.match(migrationSource, /returns table \([\s\S]*overdue_days integer/i)
  assert.match(migrationSource, /loan_ban_remaining_days integer/i)
  assert.match(migrationSource, /loans\.due_on < current_date/i)
  assert.match(typeSource, /loan_ban_remaining_days: number/)
  assert.match(typeSource, /overdue_days: number/)
})
