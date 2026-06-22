import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Facebook, Linkedin, Instagram, Twitter, Phone, Mail, Globe, Play, Send } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'

interface FooterProps {
  scrollTo: (target: string) => void
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
  { label: 'Home', target: '#hero' },
  { label: 'About', target: '#about' },
  { label: 'Products', target: '#products' },
  { label: 'Management', target: '#management' },
  { label: 'Contact', target: '#contact' },
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
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/footer'))
      .then(res => res.json())
      .then(data => setFooterData(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'footer') setFooterData(payload.data)
  })

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
        stagger: 0.1,
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      }
    )
  }, { scope: footerRef })

  return (
    <footer ref={footerRef} className="bg-dark-surface relative z-10">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-16">
        {/* Top Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 footer-animate">
          <span className="font-display font-bold text-2xl tracking-[-0.02em] text-white">
            BESTWORTH
          </span>
          <div className="flex gap-5">
            {footerData?.socials.facebook && (
              <a href={footerData.socials.facebook} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-[#B8860B] transition-colors duration-300">
                <Facebook size={24} />
              </a>
            )}
            {footerData?.socials.linkedin && (
              <a href={footerData.socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-[#B8860B] transition-colors duration-300">
                <Linkedin size={24} />
              </a>
            )}
            {footerData?.socials.instagram && (
              <a href={footerData.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-[#B8860B] transition-colors duration-300">
                <Instagram size={24} />
              </a>
            )}
            {footerData?.socials.twitter && (
              <a href={footerData.socials.twitter} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-[#B8860B] transition-colors duration-300">
                <Twitter size={24} />
              </a>
            )}
            {footerData?.socials.extra?.filter((item) => item.label && item.url).map((item, index) => (
              <a
                key={`${item.label}-${index}`}
                href={buildSocialHref(item.label, item.url)}
                target={normalizePlatform(item.label) === 'phone' || normalizePlatform(item.label) === 'telephone' || normalizePlatform(item.label) === 'call' || normalizePlatform(item.label) === 'email' || normalizePlatform(item.label) === 'mail' ? undefined : '_blank'}
                rel={normalizePlatform(item.label) === 'phone' || normalizePlatform(item.label) === 'telephone' || normalizePlatform(item.label) === 'call' || normalizePlatform(item.label) === 'email' || normalizePlatform(item.label) === 'mail' ? undefined : 'noopener noreferrer'}
                aria-label={item.label}
                title={item.label}
                className="text-white/70 hover:text-[#B8860B] transition-colors duration-300"
              >
                <BrandIcon platform={item.label} />
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 h-px bg-white/10 footer-animate" />

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 footer-animate">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {footerLinks.map((link) => (
              <button
                key={link.target}
                onClick={() => scrollTo(link.target)}
                className="font-body text-sm text-white/70 hover:text-white transition-colors duration-300"
              >
                {link.label}
              </button>
            ))}
          </div>
          {footerData?.registrationNumber && (
            <span className="font-body text-[13px] text-white/50">
              {footerData.registrationNumber}
            </span>
          )}
          <span className="font-body text-[13px] text-white/50">
            {footerData?.copyright || '© 2024 Bestworth Products Limited. All rights reserved.'}
          </span>
        </div>
      </div>
    </footer>
  )
}
