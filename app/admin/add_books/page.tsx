import type { Metadata } from 'next'
import AdminAddBookForm from '@/components/admin/AdminAddBookForm'
import AdminRemoveBookPanel from '@/components/admin/AdminRemoveBookPanel'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '새 책 추가 - SanupHs Library',
  description: 'SanupHs Library 새 책 추가',
}

export default function AdminAddBooksPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminAddBookForm />
      <section id="remove-books" className="bg-gray-50 pb-14 sm:pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <AdminRemoveBookPanel />
        </div>
      </section>
      <Footer />
    </main>
  )
}
