import type { Metadata } from 'next'
import LoanManager from '@/components/admin/LoanManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '대여 관리 - SanupHs Library',
  description: 'SanupHs Library 대여 관리',
}

export const dynamic = 'force-dynamic'

export default function AdminLoansPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <section className="bg-gray-50 py-14 sm:py-16">
        <LoanManager />
      </section>
      <Footer />
    </main>
  )
}
