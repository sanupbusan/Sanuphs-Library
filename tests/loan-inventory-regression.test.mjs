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
