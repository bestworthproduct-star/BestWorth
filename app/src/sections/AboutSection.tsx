import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { ArrowRight, ShieldCheck, Factory } from 'lucide-react'

interface AboutData {
  title: string
  description: string[]
  imageUrl: string
}

export default function AboutSection() {
  const [aboutData, setAboutData] = useState<AboutData | null>(null)
  const [heroEstDate, setHeroEstDate] = useState<string>('1987')
  const sectionRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/about'))
      .then(res => res.json())
      .then(data => setAboutData(data))
      .catch(err => console.error(err))

    fetch(apiUrl('/api/content/hero'))
      .then(res => res.json())
      .then(data => {
        if (data?.establishmentDate) {
          const yearMatch = data.establishmentDate.match(/\d{4}/)
          if (yearMatch) setHeroEstDate(yearMatch[0])
        }
      })
      .catch(() => {})
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'about') setAboutData(payload.data)
  })

  useGSAP(() => {
    if (!sectionRef.current || !aboutData) return

    // Elements reveal
    const elements = sectionRef.current.querySelectorAll('.reveal-about')
    gsap.fromTo(
      elements,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      }
    )
  }, { scope: sectionRef, dependencies: [aboutData] })

  if (!aboutData) return null

  return (
    <section
      id="about"
      ref={sectionRef}
      className="bg-white relative z-20 overflow-hidden py-20 md:py-24 lg:py-28 rounded-t-[40px] md:rounded-t-[80px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)]"
    >
      {/* Subtle Industrial Blueprint Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: `radial-gradient(#060273 0.5px, transparent 0.5px), linear-gradient(to right, #060273 0.5px, transparent 0.5px), linear-gradient(to bottom, #060273 0.5px, transparent 0.5px)`,
                   backgroundSize: '40px 40px, 120px 120px, 120px 120px' }}>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 md:px-10 relative z-10">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">

          {/* Left Column: Narrative (65% width on desktop) */}
          <div className="lg:col-span-8 space-y-5 reveal-about" ref={textRef}>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="section-label section-label-light font-bold text-brass tracking-widest text-[12px]">
                  WHO WE ARE
                </span>
                <div className="h-px flex-1 bg-charcoal/10" />
              </div>
              <h2 className="font-display font-bold text-[28px] md:text-[44px] text-charcoal leading-[1.15] tracking-tight">
                {aboutData.title}
              </h2>
            </div>

            <div className="space-y-4 max-w-[720px]">
              {aboutData.description.slice(0, 2).map((para, i) => (
                <p key={i} className="font-body text-[15px] md:text-[16px] text-charcoal/75 leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              <button
                onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn-primary flex items-center gap-2 text-sm px-8 py-3.5 group"
              >
                LEARN ABOUT OUR BUSINESS <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Right Column: The Trust Card (35% width on desktop) */}
          <div className="lg:col-span-4 w-full reveal-about" ref={cardRef}>
            <div className="relative group">
              {/* Background Decorative Box (The Dangote Look) */}
              <div className="absolute -inset-4 bg-charcoal/[0.02] border border-charcoal/5 rounded-2xl -z-10" />

              <div className="bg-white border border-charcoal/10 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(6,2,115,0.08)]">
                {/* Image Section */}
                <div className="h-48 md:h-56 overflow-hidden relative">
                  <img
                    src={resolveMediaUrl(aboutData.imageUrl)}
                    alt="Bestworth Industrial Excellence"
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-charcoal/20 mix-blend-multiply" />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />

                  <div className="absolute bottom-4 left-5 text-white">
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">Established</p>
                    <p className="text-2xl font-display font-bold">{heroEstDate}</p>
                  </div>
                </div>

                {/* Content/Stats Section */}
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center text-brass shrink-0">
                      <Factory size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-charcoal text-sm uppercase tracking-wider">Industrial Capacity</h4>
                      <p className="text-xs text-charcoal/60 mt-1">High-precision manufacturing of fasteners and building materials.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center text-brass shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-charcoal text-sm uppercase tracking-wider">Quality Assurance</h4>
                      <p className="text-xs text-charcoal/60 mt-1">Every product is engineered to meet rigorous durability standards.</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-charcoal/5 flex justify-between items-center">
                    <div className="flex gap-1">
                      <div className="w-4 h-1 bg-brass rounded-full" />
                      <div className="w-2 h-1 bg-charcoal/10 rounded-full" />
                      <div className="w-2 h-1 bg-charcoal/10 rounded-full" />
                    </div>
                    <span className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest">Trust Metrics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
