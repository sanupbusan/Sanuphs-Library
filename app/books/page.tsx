import type { Metadata } from 'next'
import BookSearchSection from '@/components/books/BookSearchSection'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'

export const metadata: Metadata = {
  title: '도서 검색 - SanupHs Library',
  description: 'SanupHs Library 도서 검색',
}

export default function BooksPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <BookSearchSection />
      <Footer />
    </main>
  )
}
