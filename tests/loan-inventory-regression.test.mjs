import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

function routeHandlerSource(source, handlerName) {
  const start = source.indexOf(`export async function ${handlerName}`)
  assert.notEqual(start, -1, `Expected ${handlerName} route handler to exist`)

  const nextHandler = source.indexOf('\nexport async function ', start + 1)
  return nextHandler === -1 ? source.slice(start) : source.slice(start, nextHandler)
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

test('public borrower lookup and loan creation use single RPC calls', async () => {
  const loanRoute = await readProjectFile('app/api/loans/route.ts')
  const loanPost = routeHandlerSource(loanRoute, 'POST')
  const studentRoute = await readProjectFile('app/api/students/route.ts')

  assert.match(studentRoute, /\.rpc\([\s\S]*'lookup_student_for_loan'/)
  assert.doesNotMatch(studentRoute, /\.from\('students'\)|\.from\('loans'\)/)
  assert.match(loanPost, /\.rpc\([\s\S]*'create_public_loan'/)
  assert.doesNotMatch(loanPost, /\.from\('books'\)|\.from\('students'\)|\.from\('loans'\)/)
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

test('latest public return functions use the singular school book code column', async () => {
  const source = await readProjectFile('supabase/migrations/20260617100000_force_replace_return_school_book_code_functions.sql')

  assert.match(source, /drop function if exists public\.get_returnable_loan_by_school_book_code\(text\)/i)
  assert.match(source, /drop function if exists public\.return_loans_by_school_book_codes\(text\[\]\)/i)
  assert.match(source, /create function public\.get_returnable_loan_by_school_book_code/i)
  assert.match(source, /create function public\.return_loans_by_school_book_codes/i)
  assert.match(source, /books\.school_book_code/i)
  assert.doesNotMatch(source, /books\.school_book_codes/i)
})

test('loan due date repair migration removes stale loan triggers and qualifies due_on references', async () => {
  const source = await readProjectFile('supabase/migrations/20260612120000_repair_loan_due_on_ambiguity.sql')

  assert.match(source, /pg_trigger/i)
  assert.ok(source.includes("pg_get_functiondef(trigger_function.oid) ~* '\\mdue_on\\M'"))
  assert.match(source, /drop trigger if exists %I on public\.loans/i)
  assert.match(source, /public\.loans\.due_on < current_date/i)
  assert.doesNotMatch(source, /[^.]due_on < current_date/i)
})

test('public book lookup, borrower lookup, and loan creation do not require admin login', async () => {
  const loanRoute = await readProjectFile('app/api/loans/route.ts')
  const loanGet = routeHandlerSource(loanRoute, 'GET')
  const loanPost = routeHandlerSource(loanRoute, 'POST')
  const studentRoute = await readProjectFile('app/api/students/route.ts')
  const bookLookupRoute = await readProjectFile('app/api/books/lookup/route.ts')

  assert.match(loanGet, /requireAdminSession/)
  assert.doesNotMatch(loanPost, /requireAdminSession|adminAuthErrorResponse/)
  assert.match(loanPost, /createRouteSupabaseClient/)
  assert.doesNotMatch(studentRoute, /requireAdminSession|adminAuthErrorResponse/)
  assert.match(studentRoute, /createRouteSupabaseClient/)
  assert.doesNotMatch(bookLookupRoute, /requireAdminSession|adminAuthErrorResponse/)
  assert.match(bookLookupRoute, /createServerSupabaseClient/)
})

test('service role key is documented as server-only', async () => {
  const envExample = await readProjectFile('.env.example')
  const serviceClient = await readProjectFile('lib/supabase-service.ts')
  const publicLoanRoute = await readProjectFile('app/api/loans/route.ts')
  const studentRoute = await readProjectFile('app/api/students/route.ts')

  assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=/m)
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(envExample, /Public rent APIs use RPCs and do not require it/)
  assert.match(serviceClient, /import 'server-only'/)
  assert.doesNotMatch(serviceClient, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(publicLoanRoute, /supabase-service|SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(studentRoute, /supabase-service|SUPABASE_SERVICE_ROLE_KEY/)
})
