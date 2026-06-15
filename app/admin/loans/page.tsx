import type { Metadata } from 'next'
import LoanManager from '@/components/admin/LoanManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { listAdminLoans } from '@/lib/admin-loans'
import { requireAdminPageSession } from '@/lib/admin-server-auth'

export const metadata: Metadata = {
  title: '대여 관리 - SanupHs Library',
  description: 'SanupHs Library 대여 관리',
}

export const dynamic = 'force-dynamic'

export default async function AdminLoansPage() {
  const session = await requireAdminPageSession()
  const loans = await listAdminLoans(session.supabase)

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <section className="bg-gray-50 py-14 sm:py-16">
        <LoanManager initialLoans={loans} />
      </section>
      <Footer />
    </main>
  )
}
