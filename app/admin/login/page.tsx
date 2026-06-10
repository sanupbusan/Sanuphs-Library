import type { Metadata } from 'next'
import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = {
  title: '로그인 - SanupHs Library',
  description: 'SanupHs Library 로그인',
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 items-center justify-center px-4 py-14 sm:px-6 lg:px-8">
        <AdminLoginForm />
      </div>
      <Footer />
    </main>
  )
}
