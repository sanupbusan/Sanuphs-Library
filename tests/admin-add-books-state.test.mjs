import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadStateHelpers() {
  const source = await readFile('components/admin/adminBookListState.ts', 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }

  new Function('exports', 'module', transpiled)(module.exports, module)

  return module.exports
}

function book(id) {
  return { id }
}

test('newly created admin book is prepended without waiting for server refresh', async () => {
  const { prependCreatedAdminBook } = await loadStateHelpers()
  const createdBook = book('created')
  const nextBooks = prependCreatedAdminBook([book('oldest'), book('older')], createdBook)

  assert.equal(nextBooks[0], createdBook)
  assert.deepEqual(nextBooks.map((item) => item.id), ['created', 'oldest', 'older'])
})

test('created admin book replaces a stale copy and preserves the 100-row page size', async () => {
  const { prependCreatedAdminBook } = await loadStateHelpers()
  const createdBook = book('50')
  const currentBooks = Array.from({ length: 100 }, (_, index) => book(String(index)))
  const nextBooks = prependCreatedAdminBook(currentBooks, createdBook)

  assert.equal(nextBooks.length, 100)
  assert.equal(nextBooks[0], createdBook)
  assert.equal(nextBooks.filter((item) => item.id === createdBook.id).length, 1)
})

test('deleted admin book is removed from local add-book page state', async () => {
  const { removeAdminBookById } = await loadStateHelpers()
  const nextBooks = removeAdminBookById([book('keep'), book('remove')], 'remove')

  assert.deepEqual(nextBooks.map((item) => item.id), ['keep'])
})
