import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

test('admin add book form is driven by barcode inputs instead of action buttons', async () => {
  const source = await readProjectFile('components/admin/AdminAddBookForm.tsx')

  assert.doesNotMatch(source, /<button\b/)
  assert.doesNotMatch(source, /onClick=/)
  assert.match(source, /onEnter=\{handleIsbnEnter\}/)
  assert.match(source, /onEnter=\{handleSchoolBookCodeEnter\}/)
})

test('admin add book flow advances to school code scan and refocuses ISBN after submit', async () => {
  const source = await readProjectFile('components/admin/useAdminAddBookForm.ts')

  assert.match(source, /activeStep !== 'info' \|\| !isInfoComplete/)
  assert.match(source, /setActiveStep\('code'\)/)
  assert.match(source, /isLookupInfoComplete\(book\)/)
  assert.match(source, /setShouldFocusSchoolBookCode\(true\)/)
  assert.match(source, /focusSchoolBookCodeInput\(\{ select: true \}\)/)
  assert.match(source, /setShouldFocusNextIsbn\(true\)/)
  assert.match(source, /focusIsbnInput\(\{ select: true \}\)/)
})

test('admin add book barcode fields normalize once after Korean IME composition', async () => {
  const formSource = await readProjectFile('components/admin/AdminAddBookForm.tsx')
  const hookSource = await readProjectFile('components/admin/useAdminAddBookForm.ts')
  const barcodeSource = await readProjectFile('lib/barcode-input.ts')

  assert.match(formSource, /onCompositionStart=\{\(\) => handleScanCompositionStart\('schoolBookCode'\)\}/)
  assert.match(formSource, /onCompositionEnd=\{\(value\) => handleScanCompositionEnd\('schoolBookCode', value\)\}/)
  assert.match(hookSource, /composingFieldRef\.current === field/)
  assert.match(hookSource, /\[field\]: value/)
  assert.match(barcodeSource, /normalizeBarcodeInput[\s\S]*\.toUpperCase\(\)/)
  assert.match(barcodeSource, /normalizeIsbnInput[\s\S]*\.toUpperCase\(\)/)
})
