import type { Metadata } from 'next'
import AutoReturnForm from '@/components/returns/AutoReturnForm'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '도서 반납 - SanupHs Library',
  description: 'SanupHs Library 도서 반납',
}

export const dynamic = 'force-dynamic'

export default function ReturnsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <section className="bg-gray-50 py-14 sm:py-16">
        <AutoReturnForm />
      </section>
      <Footer />
    </main>
  )
}
