import type { Metadata } from 'next'
import AdminAddBooksManager from '@/components/admin/AdminAddBooksManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { listAdminBooks } from '@/lib/admin-books'
import { requireAdminPageSession } from '@/lib/admin-server-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '새 책 추가 - SanupHs Library',
  description: 'SanupHs Library 새 책 추가',
}

export default async function AdminAddBooksPage() {
  const session = await requireAdminPageSession()
  const books = await listAdminBooks(session.supabase)

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminAddBooksManager initialBooks={books} />
      <Footer />
    </main>
  )
}
