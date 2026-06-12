import type { Metadata } from 'next'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import { Code2, LibraryBig } from 'lucide-react'

export const metadata: Metadata = {
  title: '개발진 소개 - SanupHs Library',
  description: 'SanupHs Library 개발진 소개',
}

const developers = [
  {
    role: 'FullStack / Security',
    name: '유재완',
    icon: Code2,
    history:
      '개발 이력 :\n前 Team Abean Main Dev\n現 TeamNull Dev',
    description:
      '현재 Niiov라고 하는 회사 창업을 준비하며 SaaS, App, Game등을 \n 개발하고 있습니다. 또한 정보보안을 주로 다루며, 해당 사이트의 \n 모의해킹, 보안 검수를 진행했습니다. 이 프로젝트와 함께 \n "쿠키 동의 배너 디자인과 개인정보 보호 인식이 한국 웹 사용자의 의사결정에 미치는 영향"이라는 논문을 작성하고 있습니다.',
  },
  {
    role: 'Backend',
    name: '김건우',
    icon: LibraryBig,
    history:'개발 이력 :\n 無',
    description:
      '현재 부산산업학교 IT컨텐츠학과에 재학 중이며 프로그레밍을 \n 배워 가는 중입니다. 산업학교 도서 대여 서비스를 개발하며 \n 경험을 쌓아 나가고 있습니다.',
  },
]

export default function DevPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold text-primary-600">
              SanupHs Library
            </p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
              개발진 소개
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
              학교 도서관을 더 편리하게 사용할 수 있도록 서비스를 만들고 있는 개발진입니다.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {developers.map((developer) => (
              <article
                key={developer.name}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <developer.icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <p className="text-sm font-medium text-primary-600">
                  {developer.role}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  {developer.name}
                </h2>
                {'history' in developer && developer.history ? (
                  <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-gray-900">
                    {developer.history}
                  </p>
                ) : null}
                {developer.description ? (
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600">
                    {developer.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
