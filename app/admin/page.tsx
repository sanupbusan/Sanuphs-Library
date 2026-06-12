import type { Metadata } from 'next'
import AdminDashboard from '@/components/admin/AdminDashboard'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '관리 콘솔 - SanupHs Library',
  description: 'SanupHs Library 보호 기능 콘솔',
}

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminDashboard />
      <Footer />
    </main>
  )
}
