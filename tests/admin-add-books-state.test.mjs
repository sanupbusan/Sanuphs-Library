import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadTsModule(relativePath) {
  const source = await readFile(relativePath, 'utf8')
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

async function loadStateHelpers() {
  return loadTsModule('components/admin/adminBookListState.ts')
}

async function loadInputHelpers() {
  return loadTsModule('lib/admin-book-input.ts')
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

test('admin book registration accepts complete book info without ISBN', async () => {
  const {
    getMissingAdminBookRequiredFieldsMessage,
    getNullableAdminBookIsbn,
  } = await loadInputHelpers()
  const { prependCreatedAdminBook } = await loadStateHelpers()
  const input = {
    author: 'ISBN 없는 저자',
    isbn: '',
    publisher: 'ISBN 없는 출판사',
    schoolBookCode: 'NO-ISBN-001',
    title: 'ISBN 없는 도서',
  }
  const createdBook = {
    ...input,
    id: 'no-isbn-book',
    isbn: getNullableAdminBookIsbn(input),
    school_book_code: input.schoolBookCode,
  }
  const nextBooks = prependCreatedAdminBook([], createdBook)

  assert.equal(getMissingAdminBookRequiredFieldsMessage(input), '')
  assert.equal(createdBook.isbn, null)
  assert.equal(nextBooks[0], createdBook)
})

test('admin book registration still requires school code when ISBN is empty', async () => {
  const { getMissingAdminBookRequiredFieldLabels } = await loadInputHelpers()
  const input = {
    author: '저자',
    isbn: '',
    publisher: '출판사',
    schoolBookCode: '',
    title: '도서명',
  }

  assert.deepEqual(getMissingAdminBookRequiredFieldLabels(input), ['학교 내 도서 코드'])
})

test('complete ISBN lookup moves directly to the school-code step', async () => {
  const { getAdminBookLookupSuccessStep } = await loadInputHelpers()

  assert.equal(
    getAdminBookLookupSuccessStep({
      author: '조회된 저자',
      publisher: '조회된 출판사',
      title: '조회된 도서',
    }),
    'code'
  )
})

test('incomplete ISBN lookup stays on the book-info step', async () => {
  const { getAdminBookLookupSuccessStep } = await loadInputHelpers()

  assert.equal(
    getAdminBookLookupSuccessStep({
      author: '',
      publisher: '조회된 출판사',
      title: '조회된 도서',
    }),
    'info'
  )
})

test('13-digit ISBN barcode input is considered ready for automatic lookup', async () => {
  const { isAdminBookIsbnScanComplete } = await loadInputHelpers()

  assert.equal(isAdminBookIsbnScanComplete('9781234567890'), true)
  assert.equal(isAdminBookIsbnScanComplete('978123456789'), false)
})

test('filled 13-digit ISBN field starts automatic lookup without Enter', async () => {
  const { shouldAutoLookupAdminBookIsbn } = await loadInputHelpers()

  assert.equal(
    shouldAutoLookupAdminBookIsbn({
      activeStep: 'isbn',
      isbn: '9781234567890',
      isLookingUpIsbn: false,
      lastAutoLookupIsbn: '',
    }),
    true
  )
  assert.equal(
    shouldAutoLookupAdminBookIsbn({
      activeStep: 'isbn',
      isbn: '9781234567890',
      isLookingUpIsbn: false,
      lastAutoLookupIsbn: '9781234567890',
    }),
    false
  )
})
