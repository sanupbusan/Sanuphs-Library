import type { Metadata } from 'next'
import Header from '@/components/sections/Header'
import BookSearchSection from '@/components/sections/BookSearchSection'
import Footer from '@/components/sections/Footer'

export const metadata: Metadata = {
  title: '도서 검색 - SanupHs Library',
  description: '학교 도서관의 도서를 제목, 저자, 카테고리로 검색하세요.',
}

export default function BooksPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <BookSearchSection />
      </div>
      <Footer />
    </main>
  )
}
