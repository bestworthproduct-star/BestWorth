import { useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import GrainCanvas from './components/GrainCanvas'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import HeroSection from './sections/HeroSection'
import AboutSection from './sections/AboutSection'
import ValuesSection from './sections/ValuesSection'
import ProductsSection from './sections/ProductsSection'
import ManagementSection from './sections/ManagementSection'
import ContactSection from './sections/ContactSection'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const lenisRef = useRef<Lenis | null>(null)
  const location = useLocation()
  const isAdminPath = location.pathname === '/admin' || location.pathname === '/login'

  useEffect(() => {
    if (isAdminPath) return

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(lenis.raf as any)
    }
  }, [isAdminPath])

  const scrollTo = (target: string) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: 0 })
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/" element={
        <div className="relative">
          <GrainCanvas />
          <Navigation scrollTo={scrollTo} />
          <main>
            <HeroSection scrollTo={scrollTo} />
            <AboutSection />
            <ValuesSection />
            <ProductsSection />
            <ManagementSection />
            <ContactSection />
            <Footer scrollTo={scrollTo} />
          </main>
        </div>
      } />
    </Routes>
  )
}

export default App
