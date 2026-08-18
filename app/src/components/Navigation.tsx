import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Menu, X } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

const navLinks = [
  { label: 'OVERVIEW', target: '#hero', icon: <Menu size={20} /> },
  { label: 'WHO WE ARE', target: '#about', icon: <Menu size={20} /> },
  { label: 'WHAT WE DO', target: '#products', icon: <Menu size={20} /> },
  { label: 'LEADERSHIP', target: '#management', icon: <Menu size={20} /> },
  { label: 'GET IN TOUCH', target: '#contact', icon: <Menu size={20} /> },
]

const FALLBACK_NAV_LOGO = '/assets/Open Sidebar Logo.jpg'

export default function Navigation({ scrollTo }: { scrollTo: (target: string) => void }) {
  const [activeSection, setActiveSection] = useState('hero')
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [brandingLogo, setBrandingLogo] = useState(FALLBACK_NAV_LOGO)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/branding'))
      .then(res => res.ok ? res.json() : null)
      .then(data => setBrandingLogo(resolveMediaUrl(data?.logoUrl) || FALLBACK_NAV_LOGO))
      .catch(err => {
        console.error('Error fetching branding logo:', err)
        setBrandingLogo(FALLBACK_NAV_LOGO)
      })
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'branding') {
      setBrandingLogo(resolveMediaUrl(payload.data?.logoUrl) || FALLBACK_NAV_LOGO)
    }
  })

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)

      const sections = ['hero', 'about', 'products', 'management', 'contact']
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i])
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= window.innerHeight * 0.5) {
            setActiveSection(sections[i])
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useGSAP(() => {
    if (mobileOpen && mobileMenuRef.current) {
      // Animate Sidebar sliding in
      gsap.fromTo(
        mobileMenuRef.current,
        { x: '-100%' },
        { x: '0%', duration: 0.4, ease: 'power3.out' }
      )

      // Stagger the links for a premium feel
      gsap.fromTo(
        '.mobile-nav-link',
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          stagger: 0.06,
          ease: 'power2.out',
          delay: 0.2
        }
      )
    }
  }, { dependencies: [mobileOpen] })

  const handleNavClick = (target: string) => {
    scrollTo(target)
    setMobileOpen(false)
  }

  const goToAdminLogin = () => {
    window.location.href = '/login'
  }

  return (
    <>
      {/* Desktop Top Bar Navigation */}
      <nav
        className="hidden md:flex fixed top-0 left-0 right-0 items-center justify-between px-12 z-50 transition-all duration-500"
        style={{
          height: scrolled ? '80px' : '112px',
          backgroundColor: scrolled ? 'rgb(6, 2, 115)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(214,69,69,0.3)' : 'none'
        }}
      >
        {/* Logo Left */}
        <div className="flex items-center">
          <button
            onClick={() => handleNavClick('#hero')}
            className="transition-all duration-500 transform hover:scale-105"
          >
            <img 
              src={brandingLogo}
              alt="BESTWORTH" 
              className="transition-all duration-500 w-auto object-contain"
              style={{ height: scrolled ? '42px' : '54px' }}
            />
          </button>
        </div>

        {/* Floating Nav Links Center/Right */}
        <div className="flex items-center gap-10">
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => handleNavClick(link.target)}
              className="font-body font-medium text-[13px] uppercase tracking-[0.15em] transition-all duration-300 relative group"
              style={{
                color: activeSection === link.target.slice(1) ? '#D64545' : 'rgba(255,255,255,0.78)',
              }}
            >
              <span className="relative z-10 group-hover:text-[#D64545]">{link.label}</span>
              <div 
                className={`absolute -bottom-2 left-0 w-full h-[1px] bg-[#D64545] transition-all duration-300 origin-left ${activeSection === link.target.slice(1) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
              />
            </button>
          ))}
          <button
            onClick={goToAdminLogin}
            className="border border-white/20 px-4 py-2 font-body text-[11px] uppercase tracking-[0.18em] text-white/80 transition-all duration-300 hover:border-[#D64545] hover:text-[#D64545] rounded-lg"
          >
            Admin Login
          </button>
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <nav className="md:hidden fixed top-0 left-0 right-0 h-14 bg-charcoal flex items-center justify-between px-4 z-50">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-1">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <button
          onClick={() => handleNavClick('#hero')}
          className="transition-all duration-300 hover:opacity-90"
        >
          <img
            src={brandingLogo}
            alt="BESTWORTH"
            className="h-8 w-auto object-contain"
          />
        </button>
        <button onClick={goToAdminLogin} className="text-[10px] uppercase tracking-[0.15em] text-white/80">
          Login
        </button>
      </nav>

      {/* Mobile Menu Overlay Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100] top-14">
          {/* Backdrop (Dark Layer outside sidebar) */}
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />

          {/* Sidebar Drawer */}
          <div
            ref={mobileMenuRef}
            className="absolute left-0 top-0 h-full w-[55%] max-w-[240px] bg-white shadow-xl flex flex-col border-r border-charcoal/5"
          >
            {/* Sidebar Navigation Links List */}
            <nav className="flex-1 overflow-y-auto pt-10">
              {navLinks.map((link) => (
                <button
                  key={link.target}
                  onClick={() => handleNavClick(link.target)}
                  className="mobile-nav-link w-full text-left px-6 py-4 border-b border-charcoal/[0.04] transition-all"
                >
                  <span
                    className={`font-display font-bold text-[14px] tracking-tight ${
                      activeSection === link.target.slice(1)
                        ? 'text-brass'
                        : 'text-charcoal/70'
                    }`}
                  >
                    {link.label}
                  </span>
                </button>
              ))}
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-charcoal/5 bg-warm-stone/10">
              <button
                onClick={goToAdminLogin}
                className="w-full py-3 bg-charcoal text-white font-body font-bold text-[9px] uppercase tracking-[0.15em] rounded-md"
              >
                Admin Login
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
