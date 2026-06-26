import * as XLSX from 'xlsx'
import { requireAdminSession } from '@/lib/admin-auth'
import {
  ADMIN_BOOK_IMPORT_HEADER_TO_FIELD,
  insertAdminBooksInBatches,
  type ImportAdminBookError,
  type ImportAdminBookRow,
} from '@/lib/admin-books'
import { ApiRouteError, jsonData, runApiRoute, throwApiError } from '@/lib/api-route'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/barcode-input'
import type { BookRow } from '@/types/library'

export const dynamic = 'force-dynamic'

type SheetRow = Record<string, string | number | boolean | null | undefined>

function getCellText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }

  return ''
}

function getOptionalText(value: unknown) {
  const text = getCellText(value)
  return text ? text : null
}

function parseRequiredInteger(
  value: unknown,
  fieldLabel: string,
  rowNumber: number,
  defaultValue: number
) {
  const text = getCellText(value)

  if (!text) {
    return defaultValue
  }

  if (!/^\d+$/.test(text)) {
    throw new ApiRouteError(400, 'INVALID_EXCEL_ROW', `${rowNumber}행의 ${fieldLabel}는 0 이상의 정수여야 합니다.`)
  }

  return Number(text)
}

function mapSheetRow(row: SheetRow): Partial<Record<keyof BookRow, unknown>> {
  const mapped: Partial<Record<keyof BookRow, unknown>> = {}

  for (const [header, value] of Object.entries(row)) {
    const field = ADMIN_BOOK_IMPORT_HEADER_TO_FIELD[header.trim()]
    if (!field) {
      continue
    }

    mapped[field] = value
  }

  return mapped
}

function buildImportRow(row: SheetRow, index: number): ImportAdminBookRow {
  const rowNumber = index + 2
  const mappedRow = mapSheetRow(row)
  const title = getCellText(mappedRow.title)
  const author = getCellText(mappedRow.author)

  if (!title || !author) {
    const missingFields = [!title && '도서명', !author && '저자'].filter(Boolean).join(', ')
    throw new ApiRouteError(
      400,
      'INVALID_EXCEL_ROW',
      `${rowNumber}행의 ${missingFields}을(를) 입력해주세요.`
    )
  }

  const totalCopies = parseRequiredInteger(mappedRow.total_copies, '총 권수', rowNumber, 1)
  const availableCopies = parseRequiredInteger(
    mappedRow.available_copies,
    '대여 가능 권수',
    rowNumber,
    1
  )

  if (totalCopies < 1) {
    throw new ApiRouteError(400, 'INVALID_EXCEL_ROW', `${rowNumber}행의 총 권수는 1 이상이어야 합니다.`)
  }

  if (availableCopies < 0) {
    throw new ApiRouteError(
      400,
      'INVALID_EXCEL_ROW',
      `${rowNumber}행의 대여 가능 권수는 0 이상이어야 합니다.`
    )
  }

  if (availableCopies > totalCopies) {
    throw new ApiRouteError(
      400,
      'INVALID_EXCEL_ROW',
      `${rowNumber}행의 대여 가능 권수는 총 권수보다 클 수 없습니다.`
    )
  }

  return {
    book: {
      author,
      available_copies: availableCopies,
      category: getCellText(mappedRow.category) || '미분류',
      isbn: normalizeIsbnInput(getOptionalText(mappedRow.isbn) ?? '') || null,
      publisher: getOptionalText(mappedRow.publisher),
      school_book_code: normalizeBarcodeInput(getOptionalText(mappedRow.school_book_code) ?? '') || null,
      title,
      total_copies: totalCopies,
    },
    rowNumber,
  }
}

async function readWorkbookRows(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new ApiRouteError(400, 'EMPTY_EXCEL_FILE', '비어 있는 엑셀 파일입니다.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json<SheetRow>(worksheet, {
    blankrows: false,
    defval: '',
    raw: true,
  })
}

function getImportFile(formData: FormData) {
  const fileEntry = formData.get('file')

  if (!(fileEntry instanceof File)) {
    throwApiError(400, 'MISSING_FILE', '업로드할 엑셀 파일을 선택해주세요.')
  }

  if (!fileEntry.name.toLowerCase().endsWith('.xlsx')) {
    throwApiError(400, 'INVALID_FILE_TYPE', '.xlsx 파일만 업로드할 수 있습니다.')
  }

  return fileEntry
}

export async function POST(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'IMPORT_BOOKS_FAILED',
        message: '엑셀 업로드에 실패했습니다.',
      },
      logLabel: 'Admin book import error:',
    },
    async () => {
      const session = await requireAdminSession(request)

      let formData: FormData

      try {
        formData = await request.formData()
      } catch {
        throw new ApiRouteError(400, 'INVALID_FORM_DATA', 'multipart/form-data 요청이 필요합니다.')
      }

      const file = getImportFile(formData)
      const sheetRows = await readWorkbookRows(file)
      const validRows: ImportAdminBookRow[] = []
      const validationErrors: ImportAdminBookError[] = []

      sheetRows.forEach((row, index) => {
        try {
          validRows.push(buildImportRow(row, index))
        } catch (error) {
          if (error instanceof ApiRouteError) {
            validationErrors.push({
              message: error.message,
              row: index + 2,
            })
            return
          }

          throw error
        }
      })

      const importResult = await insertAdminBooksInBatches(session.supabase, validRows)
      const errors = [...validationErrors, ...importResult.errors]

      return jsonData({
        errors,
        failed: errors.length,
        inserted: importResult.inserted,
        skipped: importResult.skipped,
      })
    }
  )
}
