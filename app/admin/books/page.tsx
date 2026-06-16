import type { Metadata } from 'next'
import AdminBooksManager from '@/components/admin/AdminBooksManager'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { listAdminBooks } from '@/lib/admin-books'
import { requireAdminPageSession } from '@/lib/admin-server-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '도서관리 - SanupHs Library',
  description: 'SanupHs Library 도서관리',
}

export default async function AdminBooksPage() {
  const session = await requireAdminPageSession()
  const books = await listAdminBooks(session.supabase)

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminBooksManager initialBooks={books} />
      <Footer />
    </main>
  )
}
