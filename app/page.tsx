import Header from '@/components/sections/Header'
import HeroWithDashboard from '@/components/sections/HeroWithDashboard'
import FeatureCards from '@/components/sections/FeatureCards'
import Footer from '@/components/sections/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <HeroWithDashboard />
      <FeatureCards />
      <Footer />
    </main>
  )
}
