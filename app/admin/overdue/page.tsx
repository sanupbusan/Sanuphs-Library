import type { Metadata } from 'next'
import AdminOverdueManager from '@/components/admin/AdminOverdueManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '연체관리 - SanupHs Library',
  description: 'SanupHs Library 연체관리',
}

export default function AdminOverduePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminOverdueManager />
      <Footer />
    </main>
  )
}
