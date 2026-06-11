import type { Metadata } from 'next'
import AdminBooksManager from '@/components/admin/AdminBooksManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '도서관리 - SanupHs Library',
  description: 'SanupHs Library 도서관리',
}

export default function AdminBooksPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminBooksManager />
      <Footer />
    </main>
  )
}
