import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireAdminSession } from '@/lib/admin-auth'
import {
  ADMIN_BOOK_EXCEL_HEADERS,
  ADMIN_BOOK_EXPORT_FIELD_ORDER,
  listAdminBooksForExport,
} from '@/lib/admin-books'
import { runApiRoute } from '@/lib/api-route'

export const dynamic = 'force-dynamic'

function createKstTimestampFilename(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const values = {
    day: '',
    hour: '',
    minute: '',
    month: '',
    year: '',
  }

  for (const part of parts) {
    if (part.type in values) {
      values[part.type as keyof typeof values] = part.value
    }
  }

  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}.xlsx`
}

export async function GET(request: Request) {
  return runApiRoute(
    {
      fallback: {
        code: 'EXPORT_BOOKS_FAILED',
        message: '엑셀 다운로드에 실패했습니다.',
      },
      logLabel: 'Admin book export error:',
    },
    async () => {
      const session = await requireAdminSession(request)
      const books = await listAdminBooksForExport(session.supabase)

      const worksheet = XLSX.utils.aoa_to_sheet([
        ADMIN_BOOK_EXPORT_FIELD_ORDER.map((field) => ADMIN_BOOK_EXCEL_HEADERS[field]),
        ...books.map((book) =>
          ADMIN_BOOK_EXPORT_FIELD_ORDER.map((field) => {
            const value = book[field]
            return value === null ? '' : value
          })
        ),
      ])

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'books')

      const buffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      })

      return new NextResponse(buffer, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Content-Disposition': `attachment; filename="${createKstTimestampFilename()}"`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    }
  )
}
