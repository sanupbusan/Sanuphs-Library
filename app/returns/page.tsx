import type { Metadata } from 'next'
import ReturnBooksSection from '@/components/returns/ReturnBooksSection'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '도서 반납 - SanupHs Library',
  description: 'SanupHs Library 도서 반납',
}

type ReturnsPageProps = {
  searchParams?: {
    code?: string | string[]
  }
}

function getInitialSchoolBookCode(searchParams: ReturnsPageProps['searchParams']) {
  const code = searchParams?.code

  if (Array.isArray(code)) {
    return code[0]?.trim() ?? ''
  }

  return code?.trim() ?? ''
}

export default function ReturnsPage({ searchParams }: ReturnsPageProps) {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <ReturnBooksSection initialSchoolBookCode={getInitialSchoolBookCode(searchParams)} />
      <Footer />
    </main>
  )
}
