import type { Metadata } from 'next'
import RentBookForm from '@/components/rent/RentBookForm'
import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'

export const metadata: Metadata = {
  title: '도서 대여 - SanupHs Library',
  description: 'SanupHs Library 도서 대여',
}

export const dynamic = 'force-dynamic'

export default function RentPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <section className="bg-gray-50 py-14 sm:py-16">
        <RentBookForm />
      </section>
      <Footer />
    </main>
  )
}
