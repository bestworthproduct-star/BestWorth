import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'HOME', target: '#hero', icon: <Menu size={20} /> },
  { label: 'ABOUT', target: '#about', icon: <Menu size={20} /> },
  { label: 'PRODUCTS', target: '#products', icon: <Menu size={20} /> },
  { label: 'MANAGEMENT', target: '#management', icon: <Menu size={20} /> },
  { label: 'CONTACT', target: '#contact', icon: <Menu size={20} /> },
]

export default function Navigation({ scrollTo }: { scrollTo: (target: string) => void }) {
  const [activeSection, setActiveSection] = useState('hero')
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

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
      gsap.fromTo(
        mobileMenuRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      )
      gsap.fromTo(
        '.mobile-nav-link',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', delay: 0.1 }
      )
    }
  }, { dependencies: [mobileOpen] })

  const handleNavClick = (target: string) => {
    scrollTo(target)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Desktop Top Bar Navigation */}
      <nav
        className="hidden md:flex fixed top-0 left-0 right-0 h-24 items-center justify-between px-12 z-50 transition-all duration-500"
        style={{
          backgroundColor: scrolled ? 'rgba(43,43,43,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(184,134,11,0.2)' : 'none'
        }}
      >
        {/* Logo Left */}
        <div className="flex items-center">
          <button
            onClick={() => handleNavClick('#hero')}
            className="transition-all duration-500 transform hover:scale-105"
          >
            <img 
              src="/assets/Open Sidebar Logo.jpg" 
              alt="BESTWORTH" 
              className="h-12 w-auto object-contain"
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
                color: activeSection === link.target.slice(1) ? '#B8860B' : 'rgba(255,255,255,0.7)',
              }}
            >
              <span className="relative z-10">{link.label}</span>
              <div 
                className={`absolute -bottom-2 left-0 w-full h-[1px] bg-[#B8860B] transition-all duration-300 origin-left ${activeSection === link.target.slice(1) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
              />
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <nav className="md:hidden fixed top-0 left-0 right-0 h-14 bg-charcoal flex items-center justify-between px-4 z-50">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-1">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <button
          onClick={() => handleNavClick('#hero')}
          className="font-display font-bold text-base uppercase tracking-[0.02em] text-white"
        >
          BESTWORTH
        </button>
        <div className="w-8" />
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden fixed inset-0 bg-charcoal z-40 flex flex-col items-center justify-center gap-8"
        >
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => handleNavClick(link.target)}
              className="mobile-nav-link font-display font-medium text-[28px] text-white/90 hover:text-[#B8860B] transition-colors duration-300"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
