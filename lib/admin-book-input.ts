export type AdminBookCreateInput = {
  author: string
  isbn: string
  publisher: string
  schoolBookCode: string
  title: string
}

export type AdminBookUpdateInput = AdminBookCreateInput

type RequiredAdminBookField = Exclude<keyof AdminBookCreateInput, 'isbn'>
type AdminBookInfoInput = Pick<AdminBookCreateInput, 'author' | 'publisher' | 'title'>

export type AdminBookLookupSuccessStep = 'code' | 'info'

type AdminBookIsbnAutoLookupState = {
  activeStep: AdminBookLookupSuccessStep | 'isbn'
  isbn: string
  isLookingUpIsbn: boolean
  lastAutoLookupIsbn: string
}

const requiredAdminBookFields: { field: RequiredAdminBookField; label: string }[] = [
  { field: 'title', label: '책 이름' },
  { field: 'author', label: '저자' },
  { field: 'publisher', label: '출판사' },
  { field: 'schoolBookCode', label: '학교 내 도서 코드' },
]

export function getMissingAdminBookRequiredFieldLabels(input: AdminBookCreateInput) {
  return requiredAdminBookFields
    .filter(({ field }) => !input[field])
    .map(({ label }) => label)
}

export function getMissingAdminBookRequiredFieldsMessage(input: AdminBookCreateInput) {
  const missingFields = getMissingAdminBookRequiredFieldLabels(input)

  return missingFields.length > 0 ? `${missingFields.join(', ')}을(를) 입력해주세요.` : ''
}

export function isAdminBookInfoComplete(input: AdminBookInfoInput) {
  return Boolean(input.title.trim() && input.author.trim() && input.publisher.trim())
}

export function isAdminBookIsbnScanComplete(isbn: string) {
  return isbn.trim().length === 13
}

export function shouldAutoLookupAdminBookIsbn({
  activeStep,
  isbn,
  isLookingUpIsbn,
  lastAutoLookupIsbn,
}: AdminBookIsbnAutoLookupState) {
  const normalizedIsbn = isbn.trim()

  return (
    activeStep === 'isbn' &&
    !isLookingUpIsbn &&
    isAdminBookIsbnScanComplete(normalizedIsbn) &&
    lastAutoLookupIsbn !== normalizedIsbn
  )
}

export function getAdminBookLookupSuccessStep(input: AdminBookInfoInput): AdminBookLookupSuccessStep {
  return isAdminBookInfoComplete(input) ? 'code' : 'info'
}

export function getNullableAdminBookIsbn(input: AdminBookCreateInput) {
  return input.isbn || null
}
