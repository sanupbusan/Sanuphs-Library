'use client'

import { Search } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            학교 도서 대여를
            <br />
            <span className="text-primary-600">더 쉽고 빠르게</span>
            <br />
            관리하세요
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            학생은 원하는 도서를 빠르게 검색하고,
            <br className="hidden sm:block" />
            관리자는 대여·반납·연체 현황을 한눈에 확인할 수 있습니다.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#search"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30"
            >
              <Search className="h-5 w-5" />
              도서 검색하기
            </a>
          </div>
        </div>
      </div>

      <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="relative h-96 w-96">
          <div className="absolute right-20 top-10 h-72 w-72 rounded-full bg-blue-100/50"></div>
          <div className="absolute right-40 top-32 h-48 w-48 rounded-full bg-blue-50/80"></div>
        </div>
      </div>
    </section>
  )
}
