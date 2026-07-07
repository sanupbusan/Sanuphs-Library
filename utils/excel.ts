export type ExcelImportError = {
  message: string
  row: number
}

export type ExcelImportSummary = {
  errors: ExcelImportError[]
  failed: number
  inserted: number
  skipped?: number
}

export type ExcelImportApiResult = {
  data?: ExcelImportSummary
  error?: {
    message?: string
  }
}

export function createExcelImportFormData(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return formData
}

export function parseExcelImportResult(result: ExcelImportApiResult, responseOk: boolean) {
  if (!responseOk || !result.data) {
    throw new Error(result.error?.message || '엑셀 업로드에 실패했습니다.')
  }

  return result.data
}

export function formatExcelImportSummary(summary: ExcelImportSummary) {
  const { errors, failed, inserted, skipped = 0 } = summary
  const detailMessage = errors
    .slice(0, 5)
    .map((error) => `${error.row}행: ${error.message}`)
    .join('\n')

  return [`추가된 도서: ${inserted}권`, `제외된 도서: ${skipped}건`, `실패한 행: ${failed}건`, detailMessage]
    .filter(Boolean)
    .join('\n')
}
