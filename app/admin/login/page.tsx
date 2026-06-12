import type { Metadata } from 'next'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '로그인 - SanupHs Library',
  description: 'SanupHs Library 로그인',
}

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-14 sm:px-6 lg:px-8">
        <AdminLoginForm />
      </section>
      <Footer />
    </main>
  )
}
