import * as XLSX from 'xlsx'
import { requireAdminSession } from '@/lib/admin-auth'
import {
  ADMIN_BOOK_IMPORT_BATCH_SIZE,
  ADMIN_BOOK_IMPORT_HEADER_TO_FIELD,
  insertAdminBooksInBatches,
  type ImportAdminBookError,
  type ImportAdminBookRow,
} from '@/services/book.service'
import { ApiRouteError, jsonData, runApiRoute, throwApiError } from '@/lib/api-route'
import { normalizeBarcodeInput, normalizeIsbnInput } from '@/lib/shared/barcode'
import type { BookRow } from '@/types/library'

export const dynamic = 'force-dynamic'

const IMPORT_LOG_TAG = '[BOOK_IMPORT]'
const ADMIN_BOOK_IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ADMIN_BOOK_IMPORT_MAX_REQUEST_SIZE_BYTES =
  ADMIN_BOOK_IMPORT_MAX_FILE_SIZE_BYTES + 1024 * 1024
const ADMIN_BOOK_IMPORT_MAX_ROWS = 50_000
const ADMIN_BOOK_IMPORT_MAX_COLUMNS = 64

function logImport(message: string, data?: Record<string, unknown>) {
  console.log(`${IMPORT_LOG_TAG} ${message}`, data ?? '')
}

type SheetCellValue = string | number | boolean | null | undefined
type SheetRow = SheetCellValue[]

type ParsedWorksheet = {
  dataRowCount: number
  headerFields: Array<keyof BookRow | undefined>
  range: XLSX.Range
  worksheet: XLSX.WorkSheet
}

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

function mapSheetRow(
  row: SheetRow,
  headerFields: ParsedWorksheet['headerFields']
): Partial<Record<keyof BookRow, unknown>> {
  const mapped: Partial<Record<keyof BookRow, unknown>> = {}

  for (let columnIndex = 0; columnIndex < headerFields.length; columnIndex += 1) {
    const field = headerFields[columnIndex]
    if (!field) {
      continue
    }

    mapped[field] = row[columnIndex]
  }

  return mapped
}

function buildImportRow(
  row: SheetRow,
  rowNumber: number,
  headerFields: ParsedWorksheet['headerFields']
): ImportAdminBookRow {
  const mappedRow = mapSheetRow(row, headerFields)
  const title = getCellText(mappedRow.title)

  if (!title) {
    throw new ApiRouteError(
      400,
      'INVALID_EXCEL_ROW',
      `${rowNumber}행의 도서명을 입력해주세요.`
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
      author: getOptionalText(mappedRow.author),
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

function throwImportFileTooLarge() {
  throw new ApiRouteError(
    413,
    'EXCEL_FILE_TOO_LARGE',
    '엑셀 파일은 최대 10MB까지 업로드할 수 있습니다.'
  )
}

function validateRequestSize(request: Request) {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) {
    return
  }

  const requestSize = Number(contentLength)
  if (
    Number.isSafeInteger(requestSize) &&
    requestSize > ADMIN_BOOK_IMPORT_MAX_REQUEST_SIZE_BYTES
  ) {
    throwImportFileTooLarge()
  }
}

async function readFormDataWithLimit(request: Request) {
  validateRequestSize(request)

  const contentType = request.headers.get('content-type')
  if (!contentType?.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiRouteError(400, 'INVALID_FORM_DATA', 'multipart/form-data 요청이 필요합니다.')
  }

  if (!request.body) {
    throw new ApiRouteError(400, 'INVALID_FORM_DATA', 'multipart/form-data 요청이 필요합니다.')
  }

  const reader = request.body.getReader()
  const chunks: ArrayBuffer[] = []
  let requestSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      requestSize += value.byteLength
      if (requestSize > ADMIN_BOOK_IMPORT_MAX_REQUEST_SIZE_BYTES) {
        await reader.cancel()
        throwImportFileTooLarge()
      }

      chunks.push(value.slice().buffer as ArrayBuffer)
    }
  } finally {
    reader.releaseLock()
  }

  try {
    return await new Response(new Blob(chunks), {
      headers: { 'content-type': contentType },
    }).formData()
  } catch {
    throw new ApiRouteError(400, 'INVALID_FORM_DATA', 'multipart/form-data 요청이 필요합니다.')
  }
}

function readSheetRow(
  worksheet: XLSX.WorkSheet,
  range: XLSX.Range,
  rowIndex: number
): SheetRow | null {
  const row: SheetRow = []
  let hasValue = false

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ c: columnIndex, r: rowIndex })]
    const value = cell?.t === 'e' ? undefined : (cell?.v as SheetCellValue)
    row.push(value)

    if (value !== null && value !== undefined) {
      hasValue = true
    }
  }

  return hasValue ? row : null
}

function getHeaderFields(headerRow: SheetRow) {
  const seenFields = new Set<keyof BookRow>()

  return headerRow.map((header) => {
    const field = ADMIN_BOOK_IMPORT_HEADER_TO_FIELD[getCellText(header)]
    if (!field || seenFields.has(field)) {
      return undefined
    }

    seenFields.add(field)
    return field
  })
}

async function readWorkbook(file: File): Promise<ParsedWorksheet> {
  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength > ADMIN_BOOK_IMPORT_MAX_FILE_SIZE_BYTES) {
    throwImportFileTooLarge()
  }

  let workbook: XLSX.WorkBook

  try {
    workbook = XLSX.read(new Uint8Array(arrayBuffer), {
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      sheetRows: ADMIN_BOOK_IMPORT_MAX_ROWS + 1,
      sheets: 0,
      type: 'array',
    })
  } catch {
    throw new ApiRouteError(400, 'INVALID_EXCEL_FILE', '올바른 .xlsx 파일이 아닙니다.')
  }

  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new ApiRouteError(400, 'EMPTY_EXCEL_FILE', '비어 있는 엑셀 파일입니다.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rangeReference = worksheet?.['!ref']

  if (!worksheet || !rangeReference) {
    throw new ApiRouteError(400, 'EMPTY_EXCEL_FILE', '비어 있는 엑셀 파일입니다.')
  }

  if (worksheet['!fullref']) {
    throw new ApiRouteError(
      413,
      'EXCEL_ROW_LIMIT_EXCEEDED',
      `엑셀 파일은 최대 ${ADMIN_BOOK_IMPORT_MAX_ROWS.toLocaleString('ko-KR')}개 행까지 업로드할 수 있습니다.`
    )
  }

  const range = XLSX.utils.decode_range(rangeReference)
  const columnCount = range.e.c - range.s.c + 1
  if (columnCount > ADMIN_BOOK_IMPORT_MAX_COLUMNS) {
    throw new ApiRouteError(
      413,
      'EXCEL_COLUMN_LIMIT_EXCEEDED',
      `엑셀 파일은 최대 ${ADMIN_BOOK_IMPORT_MAX_COLUMNS}개 열까지 업로드할 수 있습니다.`
    )
  }

  const headerRow = readSheetRow(worksheet, range, range.s.r)
  if (!headerRow) {
    throw new ApiRouteError(400, 'EMPTY_EXCEL_FILE', '비어 있는 엑셀 파일입니다.')
  }

  return {
    dataRowCount: Math.max(0, range.e.r - range.s.r),
    headerFields: getHeaderFields(headerRow),
    range,
    worksheet,
  }
}

function getImportFile(formData: FormData) {
  const fileEntry = formData.get('file')

  if (!(fileEntry instanceof File)) {
    throwApiError(400, 'MISSING_FILE', '업로드할 엑셀 파일을 선택해주세요.')
  }

  if (!fileEntry.name.toLowerCase().endsWith('.xlsx')) {
    throwApiError(400, 'INVALID_FILE_TYPE', '.xlsx 파일만 업로드할 수 있습니다.')
  }

  if (fileEntry.size > ADMIN_BOOK_IMPORT_MAX_FILE_SIZE_BYTES) {
    throwImportFileTooLarge()
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
      const importStartedAt = Date.now()
      logImport('request started')
      const session = await requireAdminSession(request)
      logImport('admin session verified', { duration_ms: Date.now() - importStartedAt })
      const formData = await readFormDataWithLimit(request)

      const file = getImportFile(formData)
      logImport('file received', { name: file.name, size_bytes: file.size })
      const workbookStartedAt = Date.now()
      const parsedWorksheet = await readWorkbook(file)
      logImport('workbook parsed', {
        duration_ms: Date.now() - workbookStartedAt,
        rows: parsedWorksheet.dataRowCount,
      })
      const errors: ImportAdminBookError[] = []
      const importResult = { inserted: 0, skipped: 0 }
      let validationErrorCount = 0
      let validRowCount = 0
      let validRowBatch: ImportAdminBookRow[] = []
      const databaseStartedAt = Date.now()

      const flushBatch = async () => {
        if (validRowBatch.length === 0) {
          return
        }

        if (validRowBatch.length > ADMIN_BOOK_IMPORT_BATCH_SIZE) {
          throw new Error('Admin book import batch size exceeded')
        }

        const batch = validRowBatch
        validRowBatch = []
        const batchResult = await insertAdminBooksInBatches(session.db, batch)
        importResult.inserted += batchResult.inserted
        importResult.skipped += batchResult.skipped
        errors.push(...batchResult.errors)
      }

      for (
        let rowIndex = parsedWorksheet.range.s.r + 1;
        rowIndex <= parsedWorksheet.range.e.r;
        rowIndex += 1
      ) {
        const row = readSheetRow(parsedWorksheet.worksheet, parsedWorksheet.range, rowIndex)
        if (!row) {
          continue
        }

        const rowNumber = rowIndex + 1
        try {
          validRowBatch.push(buildImportRow(row, rowNumber, parsedWorksheet.headerFields))
          validRowCount += 1
        } catch (error) {
          if (error instanceof ApiRouteError) {
            errors.push({
              message: error.message,
              row: rowNumber,
            })
            validationErrorCount += 1
            continue
          }

          throw error
        }

        if (validRowBatch.length === ADMIN_BOOK_IMPORT_BATCH_SIZE) {
          await flushBatch()
        }
      }

      await flushBatch()

      logImport('rows validated', {
        invalid_rows: validationErrorCount,
        valid_rows: validRowCount,
      })

      logImport('database import completed', {
        duration_ms: Date.now() - databaseStartedAt,
        inserted: importResult.inserted,
        skipped: importResult.skipped,
      })

      logImport('request completed', {
        duration_ms: Date.now() - importStartedAt,
        failed: errors.length,
      })

      return jsonData({
        errors,
        failed: errors.length,
        inserted: importResult.inserted,
        skipped: importResult.skipped,
      })
    }
  )
}
