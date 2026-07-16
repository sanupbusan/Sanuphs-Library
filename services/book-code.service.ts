type SchoolBookCodeSource = {
  school_book_code?: string | null
  school_book_codes?: string[] | null
}

function uniqueNonEmptyCodes(codes: string[]) {
  return Array.from(
    new Set(
      codes
        .map((code) => code.trim())
        .filter(Boolean)
    )
  )
}

export function getSchoolBookCodes(book: SchoolBookCodeSource) {
  return uniqueNonEmptyCodes([
    book.school_book_code ?? '',
    ...(book.school_book_codes ?? []),
  ])
}

export function hasSchoolBookCode(book: SchoolBookCodeSource, schoolBookCode: string) {
  return getSchoolBookCodes(book).includes(schoolBookCode.trim())
}

export function addSchoolBookCode(book: SchoolBookCodeSource, schoolBookCode: string) {
  return uniqueNonEmptyCodes([...getSchoolBookCodes(book), schoolBookCode])
}

export function displaySchoolBookCodes(book: SchoolBookCodeSource) {
  return getSchoolBookCodes(book).join(', ')
}
