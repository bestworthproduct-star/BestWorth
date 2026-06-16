import { useCallback, useEffect, useRef } from 'react'
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
import { apiUrl } from './lib/api'
import { resolveMediaUrl } from './lib/media'
import { useSocket } from './hooks/useSocket'

gsap.registerPlugin(ScrollTrigger)

const FALLBACK_FAVICON = '/assets/Favicon Logo.png'

function App() {
  const lenisRef = useRef<Lenis | null>(null)
  const location = useLocation()
  const isAdminPath = location.pathname === '/admin' || location.pathname === '/login'

  const applyFavicon = useCallback((faviconUrl?: string | null) => {
    if (typeof document === 'undefined') return

    const resolvedFavicon = resolveMediaUrl(faviconUrl) || FALLBACK_FAVICON
    let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

    if (!faviconLink) {
      faviconLink = document.createElement('link')
      faviconLink.rel = 'icon'
      document.head.appendChild(faviconLink)
    }

    faviconLink.type = 'image/png'
    faviconLink.href = resolvedFavicon
  }, [])

  const fetchBranding = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/content/branding'))
      if (!response.ok) {
        applyFavicon(FALLBACK_FAVICON)
        return
      }

      const branding = await response.json()
      applyFavicon(branding?.faviconUrl || FALLBACK_FAVICON)
    } catch (error) {
      console.error('Failed to load branding favicon:', error)
      applyFavicon(FALLBACK_FAVICON)
    }
  }, [applyFavicon])

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

  useEffect(() => {
    fetchBranding()
  }, [fetchBranding])

  useSocket('content_change', useCallback((payload: any) => {
    if (payload.key === 'branding') {
      applyFavicon(payload.data?.faviconUrl || FALLBACK_FAVICON)
    }
  }, [applyFavicon]))

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
