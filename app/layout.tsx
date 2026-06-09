import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SanupHs Library - 학교 도서 대여 관리 시스템',
  description: '학교 도서 대여를 더 쉽고 빠르게 관리하세요',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
