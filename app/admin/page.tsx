import type { Metadata } from 'next'
import AdminDashboard from '@/components/admin/AdminDashboard'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { requireAdminPageSession } from '@/lib/admin-server-auth'
import { serializeAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '관리 콘솔 - SanupHs Library',
  description: 'SanupHs Library 보호 기능 콘솔',
}

const DEBUG_TAG = '[LOGIN_DEBUG_PAGE]'
function dbg(msg: string, data?: unknown) {
  const ts = new Date().toISOString()
  console.log(`${DEBUG_TAG} ${ts} ${msg}`, data !== undefined ? data : '')
}

export default async function AdminPage() {
  const t0 = Date.now()
  dbg('/admin/page.tsx — RENDER START')
  const session = await requireAdminPageSession()
  dbg('/admin/page.tsx — session acquired', {
    role: session.role,
    loginId: session.user.loginId,
    duration_ms: Date.now() - t0,
  })

  dbg('/admin/page.tsx — RENDERING AdminDashboard')
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <AdminDashboard session={serializeAdminSession(session)} />
      <Footer />
    </main>
  )
}
