import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'

export function normalizeBookBarcode(value: string) {
  return normalizeBarcodeInput(value)
}

export function normalizeBookLookupCode(value: string) {
  return normalizeBookBarcode(value).toUpperCase()
}

export function normalizeBookIsbn(value: string) {
  return normalizeIsbnInput(value)
}

export function isLikelyBarcode(value: string) {
  const barcode = normalizeBookBarcode(value)

  return barcode.length >= 4 && /^[0-9A-Za-z-]+$/.test(barcode)
}

export function isLikelyIsbn(value: string) {
  const isbn = normalizeBookIsbn(value)

  return isbn.length === 10 || isbn.length === 13
}
