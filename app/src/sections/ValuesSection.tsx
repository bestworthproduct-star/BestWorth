import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Shield, Target, Briefcase, HandHeart, Leaf } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'

interface Value {
  title: string
  description: string
  icon: string
}

const iconMap: { [key: string]: any } = {
  Shield,
  Target,
  Briefcase,
  HandHeart,
  Leaf
}

export default function ValuesSection() {
  const [values, setValues] = useState<Value[]>([])
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/values'))
      .then(res => res.json())
      .then(data => setValues(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'values') setValues(payload.data)
  })

  useGSAP(() => {
    if (!sectionRef.current || values.length === 0) return

    // Header animation
    if (headerRef.current) {
      const headerEls = headerRef.current.querySelectorAll('.reveal-item')
      gsap.fromTo(
        headerEls,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      )
    }

    // Cards stagger animation
    if (cardsRef.current) {
      const cards = cardsRef.current.querySelectorAll('.value-card')
      gsap.fromTo(
        cards,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      )
    }
  }, { scope: sectionRef, dependencies: [values] })

  if (values.length === 0) return null

  return (
    <section
      id="values"
      ref={sectionRef}
      className="bg-cream relative z-10 min-h-screen flex items-center py-16 md:py-[120px]"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-12 md:mb-16">
          <span className="reveal-item section-label section-label-dark" style={{ color: '#B8860B' }}>
            OUR VALUES
          </span>
          <h2 className="reveal-item font-display font-medium text-[36px] md:text-[72px] text-charcoal leading-[1] tracking-[-0.025em] mt-4">
            The Principles That Drive Us
          </h2>
        </div>

        {/* Cards Grid */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
        >
          {values.map((value, index) => {
            const Icon = iconMap[value.icon] || Shield
            return (
              <div
                key={index}
                className="value-card bg-white border border-charcoal/15 p-8 md:p-12 transition-all duration-[400ms] hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(43,43,43,0.08)] hover:border-deep-teal group cursor-default"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <Icon
                  size={48}
                  className="text-deep-teal mb-6 transition-transform duration-300 group-hover:scale-110"
                  strokeWidth={1.5}
                />
                <h3 className="font-display font-medium text-[22px] md:text-[28px] text-charcoal leading-[1.2] tracking-[-0.01em]">
                  {value.title}
                </h3>
                <p className="font-body text-[15px] md:text-[17px] text-charcoal leading-[1.7] mt-4">
                  {value.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
