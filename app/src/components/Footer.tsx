import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Facebook, Linkedin, Instagram, Twitter } from 'lucide-react'
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
  }
}

const footerLinks = [
  { label: 'Home', target: '#hero' },
  { label: 'About', target: '#about' },
  { label: 'Products', target: '#products' },
  { label: 'Management', target: '#management' },
  { label: 'Contact', target: '#contact' },
]

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
