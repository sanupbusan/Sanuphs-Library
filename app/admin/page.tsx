import type { Metadata } from 'next'
import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import AdminDashboard from '@/components/admin/AdminDashboard'

export const metadata: Metadata = {
  title: '관리자 콘솔 - SanupHs Library',
  description: 'SanupHs Library 관리자 콘솔',
}

export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <AdminDashboard />
      </div>
      <Footer />
    </main>
  )
}
