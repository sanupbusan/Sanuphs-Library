import type { Metadata } from 'next'
import AdminOverdueManager from '@/components/admin/AdminOverdueManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { listAdminOverdueLoans } from '@/lib/admin-overdue'
import { requireAdminPageSession } from '@/lib/admin-server-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '연체 관리 - SanupHs Library',
  description: 'SanupHs Library 연체 관리',
}

export default async function AdminOverduePage() {
  const session = await requireAdminPageSession()
  const overdueLoans = await listAdminOverdueLoans(session.db)

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminOverdueManager initialOverdueLoans={overdueLoans} />
      <Footer />
    </main>
  )
}
