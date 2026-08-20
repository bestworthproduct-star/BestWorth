import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Facebook, Linkedin, Phone, Mail, Globe, Play, Send, ArrowRight, MapPin } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { Link } from 'react-router-dom'

interface FooterProps {
  scrollTo: (target: string) => void
}

interface Category {
  id: string
  name: string
}

interface FooterData {
  copyright: string
  registrationNumber?: string
  socials: {
    facebook: string
    linkedin: string
    instagram: string
    twitter?: string
    extra?: Array<{
      label: string
      url: string
    }>
  }
}

const footerLinks = [
  { label: 'OVERVIEW', target: '#hero' },
  { label: 'WHO WE ARE', target: '#about' },
  { label: 'WHAT WE DO', target: '#products' },
  { label: 'LEADERSHIP', target: '#management' },
  { label: 'NEWS & MEDIA', target: '#news-media' },
  { label: 'GET IN TOUCH', target: '#contact' },
]

const normalizePlatform = (value: string) => value.trim().toLowerCase()
const stripHandlePrefix = (value: string) => value.trim().replace(/^@/, '')

const BrandIcon = ({ platform }: { platform: string }) => {
  const iconClassName = 'w-5 h-5'

  switch (normalizePlatform(platform)) {
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className={iconClassName} fill="currentColor" aria-hidden="true">
          <path d="M14.5 3c.4 1.9 1.7 3.6 3.5 4.4 1 .5 2 .8 3 .8v3.2c-1.6 0-3.2-.4-4.6-1.2v6.3A5.53 5.53 0 0 1 10.9 22 5.53 5.53 0 0 1 5.4 16.5 5.53 5.53 0 0 1 10.9 11c.3 0 .6 0 .9.1v3.3c-.3-.1-.6-.2-.9-.2-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3V3h3.3Z" />
        </svg>
      )
    case 'x':
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" className={iconClassName} fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.4 22H3.3l7.3-8.4L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
        </svg>
      )
    case 'threads':
      return (
        <svg viewBox="0 0 24 24" className={iconClassName} fill="currentColor" aria-hidden="true">
          <path d="M16.7 10.2c-.1-2.4-1.6-3.8-4.4-3.8-2.9 0-4.7 1.6-5 4.3l2.3.4c.2-1.6 1.1-2.5 2.7-2.5 1.5 0 2.2.7 2.4 2.1-1.4-.2-2.7-.2-3.8 0-2.7.5-4.2 2-4.2 4.2 0 2.5 2 4.1 4.8 4.1 1.8 0 3.2-.6 4.1-1.8.6.9 1.4 1.5 2.5 1.8l.7-2.2c-.8-.2-1.2-.6-1.4-1.2.6-1 .9-2.3.8-3.7-.1-.6-.1-1.2-.2-1.7Zm-4.8 6.6c-1.4 0-2.4-.8-2.4-2s.9-1.9 2.5-2.2c.8-.1 1.7-.1 2.9.1-.2 2.6-1.4 4.1-3 4.1Z" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" className={iconClassName} fill="currentColor" aria-hidden="true">
          <path d="M20 11.9A8 8 0 0 0 6.4 6.1a7.92 7.92 0 0 0-1.9 8L3 20l6.1-1.6A8 8 0 1 0 20 11.9Zm-8 6.6c-1 0-2-.3-2.8-.8l-.4-.2-3.6.9.9-3.5-.2-.4a6.6 6.6 0 1 1 6.1 4Zm3.6-4.8c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1l-.4.5c-.1.1-.3.2-.5.1a5.4 5.4 0 0 1-2.6-2.3c-.1-.2 0-.3.1-.5l.3-.4c.1-.1.1-.3 0-.5l-.7-1.5c-.1-.2-.2-.2-.4-.2h-.4c-.2 0-.4.1-.6.3-.5.5-.8 1.1-.8 1.9s.8 2.2.9 2.3c.1.1 1.6 2.5 4 3.4.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.3-.6 1.5-1.2.2-.6.2-1.1.1-1.2 0-.2-.2-.2-.4-.3Z" />
        </svg>
      )
    case 'telegram':
      return <Send className={iconClassName} strokeWidth={1.8} />
    case 'youtube':
      return <Play className={iconClassName} strokeWidth={1.8} />
    case 'phone':
    case 'telephone':
    case 'call':
      return <Phone className={iconClassName} strokeWidth={1.8} />
    case 'email':
    case 'mail':
      return <Mail className={iconClassName} strokeWidth={1.8} />
    default:
      return <Globe className={iconClassName} strokeWidth={1.8} />
  }
}

const buildSocialHref = (platform: string, value: string) => {
  const normalizedPlatform = normalizePlatform(platform)
  const trimmedValue = value.trim()

  if (!trimmedValue) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmedValue)) return trimmedValue

  if (normalizedPlatform === 'phone' || normalizedPlatform === 'telephone' || normalizedPlatform === 'call') {
    return `tel:${trimmedValue}`
  }

  if (normalizedPlatform === 'email' || normalizedPlatform === 'mail') {
    return `mailto:${trimmedValue}`
  }

  if (normalizedPlatform === 'whatsapp') {
    const digitsOnly = trimmedValue.replace(/[^\d+]/g, '')
    return `https://wa.me/${digitsOnly.replace(/^\+/, '')}`
  }

  if (normalizedPlatform === 'telegram') {
    return `https://t.me/${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'tiktok') {
    return `https://www.tiktok.com/@${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'instagram') {
    return `https://www.instagram.com/${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'facebook') {
    return `https://www.facebook.com/${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'linkedin') {
    return `https://www.linkedin.com/${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'twitter' || normalizedPlatform === 'x') {
    return `https://x.com/${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'threads') {
    return `https://www.threads.net/@${stripHandlePrefix(trimmedValue)}`
  }

  if (normalizedPlatform === 'youtube') {
    const normalizedValue = stripHandlePrefix(trimmedValue)
    return normalizedValue.includes('/') ? `https://www.youtube.com/${normalizedValue}` : `https://www.youtube.com/@${normalizedValue}`
  }

  return trimmedValue.startsWith('www.') ? `https://${trimmedValue}` : `https://${trimmedValue}`
}

export default function Footer({ scrollTo }: FooterProps) {
  const [footerData, setFooterData] = useState<FooterData | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [contactInfo, setContactInfo] = useState<any>(null)
  const [branding, setBranding] = useState<any>(null)
  const [heroContent, setHeroContent] = useState<any>(null)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isSubscribed, setIsNewsletterSubscribed] = useState(false)
  const [newsletterPolicyAcknowledged, setNewsletterPolicyAcknowledged] = useState(false)
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false)
  const [newsletterError, setNewsletterError] = useState('')
  const [openMobileColumn, setOpenMobileColumn] = useState<string | null>(null)
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/footer'))
      .then(res => res.json())
      .then(data => setFooterData(data))
      .catch(err => console.error(err))

    fetch(apiUrl('/api/content/categories'))
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})

    fetch(apiUrl('/api/content/contact'))
      .then(res => res.json())
      .then(data => setContactInfo(data))
      .catch(() => {})

    fetch(apiUrl('/api/content/branding'))
      .then(res => res.json())
      .then(data => setBranding(data))
      .catch(() => {})

    fetch(apiUrl('/api/content/hero'))
      .then(res => res.json())
      .then(data => setHeroContent(data))
      .catch(() => {})
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'footer') setFooterData(payload.data)
    if (payload.key === 'categories') setCategories(Array.isArray(payload.data) ? payload.data : [])
    if (payload.key === 'contact') setContactInfo(payload.data)
    if (payload.key === 'branding') setBranding(payload.data)
    if (payload.key === 'hero') setHeroContent(payload.data)
  })

  const estYear = heroContent?.establishmentDate?.match(/\d{4}/)?.[0] || '1987'

  const toggleMobileColumn = (column: string) => {
    if (window.innerWidth >= 1024) return
    setOpenMobileColumn(openMobileColumn === column ? null : column)
  }

  useGSAP(() => {
    if (!footerRef.current) return
    gsap.fromTo(
      footerRef.current.querySelectorAll('.footer-animate'),
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 95%',
          toggleActions: 'play none none none',
        },
      }
    )
  }, { scope: footerRef })

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail) return
    setNewsletterSubmitting(true)
    setNewsletterError('')
    try {
      const response = await fetch(apiUrl('/api/newsletter/subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail, policyAcknowledged: newsletterPolicyAcknowledged, website: '' })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Subscription failed')
      setIsNewsletterSubscribed(true)
      setNewsletterEmail('')
      setNewsletterPolicyAcknowledged(false)
    } catch (error) {
      setNewsletterError(error instanceof Error ? error.message : 'Subscription failed')
    } finally {
      setNewsletterSubmitting(false)
    }
  }

  const columnLabelClass = 'font-display font-bold text-[11px] uppercase tracking-[0.25em] text-white/40 mb-6 flex items-center justify-between lg:block w-full text-left'

  return (
    <footer ref={footerRef} className="bg-dark-surface relative z-10 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-20">

        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Col 1: Brand Identity */}
          <div className="footer-animate">
            {branding?.logoUrl && (
              <img
                src={resolveMediaUrl(branding.logoUrl)}
                alt="Bestworth Logo"
                className="h-10 w-auto object-contain opacity-80 mb-6"
              />
            )}
            <span className="font-display font-bold text-2xl tracking-[-0.03em] text-white block mb-4">
              BESTWORTH
            </span>
            <p className="font-body text-sm text-white/50 leading-relaxed max-w-[240px] mb-6">
              Engineering high-performance fastening solutions since {estYear}.
            </p>
            {footerData?.registrationNumber && (
              <p className="font-body text-[11px] font-bold text-white/30 uppercase tracking-widest">
                Reg: {footerData.registrationNumber}
              </p>
            )}
            <div className="flex gap-4 mt-8">
              {footerData?.socials.facebook && (
                <a href={footerData.socials.facebook} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-brass transition-colors">
                  <Facebook size={18} />
                </a>
              )}
              {footerData?.socials.linkedin && (
                <a href={footerData.socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-brass transition-colors">
                  <Linkedin size={18} />
                </a>
              )}
              {footerData?.socials.extra?.slice(0, 3).map((item, idx) => (
                <a key={idx} href={buildSocialHref(item.label, item.url)} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-brass transition-colors">
                  <BrandIcon platform={item.label} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Product Solutions (Dynamic Accordion on Mobile) */}
          <div className="footer-animate lg:border-l lg:border-white/5 lg:pl-8">
            <button
              onClick={() => toggleMobileColumn('products')}
              className={columnLabelClass}
            >
              <span>Product Range</span>
              <span className="lg:hidden text-brass">{openMobileColumn === 'products' ? '−' : '+'}</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 lg:max-h-none ${openMobileColumn === 'products' ? 'max-h-[500px] mt-2' : 'max-h-0 lg:mt-0'}`}>
              <ul className="space-y-3 pb-4 lg:pb-0">
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => scrollTo('#products')}
                      className="font-body text-sm text-white/60 hover:text-white transition-colors uppercase tracking-wide"
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Col 3: Company Navigation (Dynamic Accordion on Mobile) */}
          <div className="footer-animate lg:border-l lg:border-white/5 lg:pl-8">
            <button
              onClick={() => toggleMobileColumn('org')}
              className={columnLabelClass}
            >
              <span>Organization</span>
              <span className="lg:hidden text-brass">{openMobileColumn === 'org' ? '−' : '+'}</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 lg:max-h-none ${openMobileColumn === 'org' ? 'max-h-[500px] mt-2' : 'max-h-0 lg:mt-0'}`}>
              <ul className="space-y-3 pb-4 lg:pb-0">
                {footerLinks.map((link) => (
                  <li key={link.target}>
                    <button
                      onClick={() => scrollTo(link.target)}
                      className="font-body text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
                <li>
                  <Link to="/privacy-policy" className="font-body text-sm text-white/60 hover:text-white transition-colors">PRIVACY POLICY</Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Col 4: Newsletter & Engagement */}
          <div className="footer-animate lg:border-l lg:border-white/5 lg:pl-8">
            <h4 className={columnLabelClass}>Stay Informed</h4>
            <p className="font-body text-sm text-white/50 mb-6 leading-relaxed">
              Sign up for technical updates and industrial news.
            </p>

            {isSubscribed ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg animate-in fade-in zoom-in duration-300">
                <p className="text-[11px] font-bold text-green-500 uppercase tracking-widest text-center">Subscription Confirmed</p>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit}>
                <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Business Email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="w-full bg-white/5 border-0 border-b border-white/10 py-3 pl-0 pr-12 text-sm text-white focus:outline-none focus:border-brass transition-colors placeholder:text-white/20"
                />
                <button
                  type="submit"
                  disabled={newsletterSubmitting}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-brass transition-colors"
                >
                  <ArrowRight size={18} />
                </button>
                </div>
                <label className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-white/35"><input type="checkbox" required checked={newsletterPolicyAcknowledged} onChange={(event) => setNewsletterPolicyAcknowledged(event.target.checked)} className="mt-0.5 accent-brass"/><span>I agree to the <Link to="/privacy-policy" className="text-white/60 underline">Privacy Policy</Link>.</span></label>
                {newsletterError && <p className="mt-2 text-[10px] text-red-300">{newsletterError}</p>}
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-start gap-3">
                <MapPin size={14} className="text-brass shrink-0 mt-1" />
                <p className="text-[11px] leading-relaxed text-white/40">{contactInfo?.address || 'Corporate Presence'}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Final Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 footer-animate">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
            {footerData?.copyright || '© 2024 Bestworth Products Limited.'}
          </p>
          <div className="flex items-center gap-6">
            <span className="font-body text-[9px] font-bold uppercase tracking-widest text-white/20">
              Engineering Excellence Site
            </span>
            <div className="h-4 w-px bg-white/5" />
            <Link to="/cookie-policy" className="text-[10px] font-bold text-white/20 hover:text-white transition-colors uppercase tracking-widest">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
