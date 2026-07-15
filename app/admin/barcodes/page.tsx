import type { Metadata } from 'next'
import BorrowerBarcodeManager from '@/components/admin/BorrowerBarcodeManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { requireAdminPageSession } from '@/lib/admin-server-auth'
import { listBorrowersForBarcodePrint } from '@/services/student.service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이용자 바코드 - SanupHs Library',
  description: '학생 및 교직원 번호 바코드 출력',
}

export default async function AdminBarcodesPage() {
  const session = await requireAdminPageSession()
  const borrowers = await listBorrowersForBarcodePrint(session.db)

  return (
    <main className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <div className="print:hidden"><Header /></div>
      <BorrowerBarcodeManager borrowers={borrowers} />
      <div className="print:hidden"><Footer /></div>
    </main>
  )
}
