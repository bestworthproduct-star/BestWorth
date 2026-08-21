import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { ArrowRight, ChevronLeft, ChevronRight, Compass, Target, Users, BriefcaseBusiness } from 'lucide-react'

interface AboutStatistic {
  label: string
  value: number
  suffix?: string
  available: boolean
}

interface ContentChangePayload {
  key?: string
  data?: AboutData
}

interface AboutData {
  title: string
  description: string[]
  imageUrl: string
  vision?: string
  mission?: string
  workerCount?: number
  workerCountLabel?: string
  workerCountSuffix?: string
  businessCount?: number
  businessCountLabel?: string
  businessCountSuffix?: string
}

const DEFAULT_VISION = 'To be a trusted Nigerian manufacturer recognized for dependable building products and responsible growth.'
const DEFAULT_MISSION = 'To support construction with durable, efficient and affordable products made to consistent quality standards.'

export default function AboutSection() {
  const [aboutData, setAboutData] = useState<AboutData | null>(null)
  const [heroEstDate, setHeroEstDate] = useState<string>('1987')
  const [activeCardSlide, setActiveCardSlide] = useState(0)
  const [cardPaused, setCardPaused] = useState(false)
  const [cardInView, setCardInView] = useState(false)
  const [displayCounts, setDisplayCounts] = useState([0, 0])
  const sectionRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const lowerCardRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

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

  useSocket('content_change', (payload: ContentChangePayload) => {
    if (payload.key === 'about' && payload.data) setAboutData(payload.data)
  })

  const workerCount = Math.max(0, Number(aboutData?.workerCount) || 0)
  const businessCount = Math.max(0, Number(aboutData?.businessCount) || 0)
  const workerCountAvailable = workerCount > 0
  const businessCountAvailable = businessCount > 0
  const cardSlideCount = 2
  const visibleCardSlide = activeCardSlide
  const statistics: AboutStatistic[] = [
    {
      label: aboutData?.workerCountLabel || 'Team Members',
      value: workerCount,
      suffix: aboutData?.workerCountSuffix ?? '+',
      available: workerCountAvailable
    },
    {
      label: aboutData?.businessCountLabel || 'Years in Business',
      value: businessCount,
      suffix: aboutData?.businessCountSuffix ?? '+',
      available: businessCountAvailable
    }
  ]

  useEffect(() => {
    if (!lowerCardRef.current) return
    const observer = new IntersectionObserver(([entry]) => setCardInView(entry.isIntersecting), { threshold: 0.45 })
    observer.observe(lowerCardRef.current)
    return () => observer.disconnect()
  }, [aboutData])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (cardPaused || reducedMotion || !cardInView || cardSlideCount < 2) return
    const timer = window.setTimeout(() => setActiveCardSlide((current) => (current + 1) % cardSlideCount), 9000)
    return () => window.clearTimeout(timer)
  }, [activeCardSlide, cardPaused, cardInView, cardSlideCount])

  useEffect(() => {
    if (visibleCardSlide !== 1 || !cardInView) return

    const targets = [workerCount, businessCount]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionFrame = requestAnimationFrame(() => setDisplayCounts(targets))
      return () => cancelAnimationFrame(reducedMotionFrame)
    }

    const startedAt = performance.now()
    let frame = 0
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 1300, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayCounts(targets.map((target) => Math.round(target * eased)))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [visibleCardSlide, cardInView, workerCount, businessCount])

  const showCardSlide = (index: number) => setActiveCardSlide((index + cardSlideCount) % cardSlideCount)

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

                {/* Only this lower panel slides; the image and establishment date stay fixed. */}
                <div
                  ref={lowerCardRef}
                  className="relative min-h-[290px] overflow-hidden"
                  onMouseEnter={() => setCardPaused(true)}
                  onMouseLeave={() => setCardPaused(false)}
                  onFocusCapture={() => setCardPaused(true)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCardPaused(false)
                  }}
                  onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
                  onTouchEnd={(event) => {
                    if (touchStartX.current === null) return
                    const distance = event.changedTouches[0].clientX - touchStartX.current
                    if (Math.abs(distance) > 45) showCardSlide(visibleCardSlide + (distance < 0 ? 1 : -1))
                    touchStartX.current = null
                  }}
                  aria-roledescription="carousel"
                  aria-label="Company profile"
                >
                  <div className="p-6 md:p-7 pb-16">
                    <div
                      className={`transition-all duration-500 ${visibleCardSlide === 0 ? 'translate-x-0 opacity-100' : '-translate-x-5 pointer-events-none absolute inset-x-6 top-6 opacity-0 md:inset-x-7 md:top-7'}`}
                      aria-hidden={visibleCardSlide !== 0}
                    >
                      <div className="space-y-5">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center text-brass shrink-0"><Compass size={19}/></div>
                          <div><h4 className="font-display font-bold text-charcoal text-sm uppercase tracking-wider">Our Vision</h4><p className="text-xs leading-relaxed text-charcoal/60 mt-1">{aboutData.vision || DEFAULT_VISION}</p></div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-brass/10 flex items-center justify-center text-brass shrink-0"><Target size={19}/></div>
                          <div><h4 className="font-display font-bold text-charcoal text-sm uppercase tracking-wider">Our Mission</h4><p className="text-xs leading-relaxed text-charcoal/60 mt-1">{aboutData.mission || DEFAULT_MISSION}</p></div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`transition-all duration-500 ${visibleCardSlide === 1 ? 'translate-x-0 opacity-100' : 'translate-x-5 pointer-events-none absolute inset-x-6 top-6 opacity-0 md:inset-x-7 md:top-7'}`}
                      aria-hidden={visibleCardSlide !== 1}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brass">Company at a glance</p>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        {statistics.map((statistic, index) => {
                          const Icon = index === 0 ? Users : BriefcaseBusiness
                          return <div key={`${statistic.label}-${index}`} className="rounded-lg border border-charcoal/8 bg-charcoal/[0.025] p-4">
                            <Icon size={17} className="text-brass"/>
                            <div className="mt-5 font-display text-[28px] font-bold leading-none text-charcoal" aria-label={statistic.available ? `${statistic.value}${statistic.suffix || ''} ${statistic.label}` : `${statistic.label} not provided`}>
                              <span aria-hidden="true">{statistic.available ? `${displayCounts[index].toLocaleString()}${statistic.suffix || ''}` : '—'}</span>
                            </div>
                            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-charcoal/45">{statistic.label}</p>
                          </div>
                        })}
                      </div>
                      <p className="mt-4 text-[10px] leading-relaxed text-charcoal/45">A growing team and operating record focused on dependable production.</p>
                    </div>
                  </div>

                  <div className="absolute inset-x-6 bottom-0 flex items-center justify-between border-t border-charcoal/5 bg-white py-4 md:inset-x-7">
                    <>
                      <div className="flex items-center gap-1.5" role="tablist" aria-label="Company profile slides">
                        {[0, 1].map((slide) => <button key={slide} type="button" role="tab" aria-selected={visibleCardSlide === slide} aria-label={`Show ${slide === 0 ? 'vision and mission' : 'company statistics'}`} onClick={() => showCardSlide(slide)} className={`h-1 rounded-full transition-all ${visibleCardSlide === slide ? 'w-5 bg-brass' : 'w-2 bg-charcoal/12 hover:bg-charcoal/25'}`}/>) }
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => showCardSlide(visibleCardSlide - 1)} aria-label="Previous company profile slide" className="rounded-md p-1.5 text-charcoal/35 transition hover:bg-charcoal/5 hover:text-charcoal"><ChevronLeft size={15}/></button>
                        <span className="min-w-8 text-center text-[9px] font-bold tabular-nums text-charcoal/35">0{visibleCardSlide + 1} / 02</span>
                        <button type="button" onClick={() => showCardSlide(visibleCardSlide + 1)} aria-label="Next company profile slide" className="rounded-md p-1.5 text-charcoal/35 transition hover:bg-charcoal/5 hover:text-charcoal"><ChevronRight size={15}/></button>
                      </div>
                    </>
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
