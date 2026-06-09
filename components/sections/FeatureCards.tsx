'use client'

import { Search, ClipboardCheck, Clock, BarChart3 } from 'lucide-react'

const features = [
  {
    icon: Search,
    title: '도서 검색',
    description: '제목, 저자, 카테고리로 원하는 책을 빠르게 찾을 수 있어요.',
  },
  {
    icon: ClipboardCheck,
    title: '대여 관리',
    description: '학생별 대여 상태와 반납 여부를 쉽게 확인할 수 있어요.',
  },
  {
    icon: Clock,
    title: '연체 확인',
    description: '반납 기한이 지난 도서를 자동으로 확인할 수 있어요.',
  },
  {
    icon: BarChart3,
    title: '대시보드',
    description: '전체 도서와 대여 현황을 한눈에 볼 수 있어요.',
  },
]

export default function FeatureCards() {
  return (
    <section id="features" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            편리한 기능들
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            도서관 관리에 필요한 모든 기능을 제공합니다
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100">
                <feature.icon className="h-6 w-6" strokeWidth={2} />
              </div>

              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                {feature.title}
              </h3>

              <p className="text-sm leading-relaxed text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
