'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import {
  createExcelImportFormData,
  formatExcelImportSummary,
  parseExcelImportResult,
  type ExcelImportApiResult,
} from '@/utils/excel'

function downloadExcel() {
  window.location.href = '/api/admin/books/export'
}

export default function ExcelImportModal() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)

  function openImportPicker() {
    if (isImporting) {
      return
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setIsImporting(true)

    try {
      const response = await fetch('/api/admin/books/import', {
        body: createExcelImportFormData(file),
        method: 'POST',
      })
      const result = await response.json() as ExcelImportApiResult
      const summary = parseExcelImportResult(result, response.ok)

      window.alert(formatExcelImportSummary(summary))

      if (summary.inserted > 0) {
        window.setTimeout(() => {
          window.location.reload()
        }, 150)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '엑셀 업로드에 실패했습니다.'
      window.alert(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleImportFileChange}
      />

      <button
        type="button"
        onClick={downloadExcel}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary-100 bg-white px-4 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50"
      >
        <Download className="h-4 w-4" />
        엑셀 다운로드
      </button>

      <button
        type="button"
        onClick={openImportPicker}
        disabled={isImporting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isImporting ? '업로드 중...' : '엑셀로 추가'}
      </button>
    </>
  )
}
