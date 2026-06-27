import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

interface TeamMember {
  _id: string
  name: string
  role: string
  bio?: string
  image: string
}

interface LeadershipSettings {
  autoSlide: boolean
  delaySeconds: number
}

const DEFAULT_LEADERSHIP_SETTINGS: LeadershipSettings = {
  autoSlide: true,
  delaySeconds: 15
}

function getCardsPerSlide(width: number) {
  if (width >= 1024) return 6
  if (width >= 640) return 4
  return 3
}

export default function ManagementSection() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [leadershipSettings, setLeadershipSettings] = useState<LeadershipSettings>(DEFAULT_LEADERSHIP_SETTINGS)
  const [cardsPerSlide, setCardsPerSlide] = useState<number>(() => getCardsPerSlide(typeof window !== 'undefined' ? window.innerWidth : 1280))
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [isSliderPaused, setIsSliderPaused] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const modalScrollRef = useRef<HTMLDivElement>(null)

  const fetchTeam = useCallback(() => {
    fetch(apiUrl('/api/team'))
      .then(res => res.json())
      .then(data => setTeam(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching team:', err))
  }, [])

  const fetchLeadershipSettings = useCallback(() => {
    fetch(apiUrl('/api/content/leadership'))
      .then((res) => (res.ok ? res.json() : DEFAULT_LEADERSHIP_SETTINGS))
      .then((data) => {
        const parsedDelay = Number(data?.delaySeconds)
        setLeadershipSettings({
          autoSlide: data?.autoSlide !== false,
          delaySeconds: Number.isFinite(parsedDelay) && parsedDelay >= 5 ? parsedDelay : DEFAULT_LEADERSHIP_SETTINGS.delaySeconds
        })
      })
      .catch(() => setLeadershipSettings(DEFAULT_LEADERSHIP_SETTINGS))
  }, [])

  useEffect(() => {
    fetchTeam()
    fetchLeadershipSettings()
  }, [fetchTeam, fetchLeadershipSettings])

  useEffect(() => {
    const updateCardsPerSlide = () => {
      setCardsPerSlide(getCardsPerSlide(window.innerWidth))
    }

    updateCardsPerSlide()
    window.addEventListener('resize', updateCardsPerSlide)

    return () => window.removeEventListener('resize', updateCardsPerSlide)
  }, [])

  useEffect(() => {
    if (!selectedMember) {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      return
    }

    const scrollY = window.scrollY
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousOverflow = document.body.style.overflow
    const previousPosition = document.body.style.position
    const previousTop = document.body.style.top
    const previousWidth = document.body.style.width

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousOverflow
      document.body.style.position = previousPosition
      document.body.style.top = previousTop
      document.body.style.width = previousWidth
      window.scrollTo(0, scrollY)
    }
  }, [selectedMember])

  useEffect(() => {
    if (!selectedMember) return

    const preventBackgroundScroll = (event: WheelEvent | TouchEvent) => {
      if (!modalScrollRef.current) {
        event.preventDefault()
        return
      }

      const target = event.target as Node | null
      if (!target || !modalScrollRef.current.contains(target)) {
        event.preventDefault()
      }
    }

    window.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true })
    window.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true })

    return () => {
      window.removeEventListener('wheel', preventBackgroundScroll, true)
      window.removeEventListener('touchmove', preventBackgroundScroll, true)
    }
  }, [selectedMember])

  useSocket('team_change', fetchTeam)
  useSocket('content_change', useCallback((payload: any) => {
    if (payload.key === 'leadership') {
      const parsedDelay = Number(payload.data?.delaySeconds)
      setLeadershipSettings({
        autoSlide: payload.data?.autoSlide !== false,
        delaySeconds: Number.isFinite(parsedDelay) && parsedDelay >= 5 ? parsedDelay : DEFAULT_LEADERSHIP_SETTINGS.delaySeconds
      })
    }
  }, []))

  const slides = useMemo(() => {
    const preparedSlides = []

    for (let index = 0; index < team.length; index += cardsPerSlide) {
      preparedSlides.push(team.slice(index, index + cardsPerSlide))
    }

    return preparedSlides
  }, [team, cardsPerSlide])

  const totalSlides = slides.length
  const hasMultipleSlides = totalSlides > 1
  const activeSlideMembers = slides[activeSlideIndex] || []

  useEffect(() => {
    setActiveSlideIndex((current) => Math.min(current, Math.max(totalSlides - 1, 0)))
  }, [totalSlides])

  useEffect(() => {
    if (!hasMultipleSlides || !leadershipSettings.autoSlide || isSliderPaused) {
      return
    }

    const timeout = window.setTimeout(() => {
      setActiveSlideIndex((current) => (current + 1) % totalSlides)
    }, leadershipSettings.delaySeconds * 1000)

    return () => window.clearTimeout(timeout)
  }, [hasMultipleSlides, leadershipSettings, isSliderPaused, totalSlides, activeSlideIndex])

  const goToNextSlide = () => {
    if (!hasMultipleSlides) return
    setActiveSlideIndex((current) => (current + 1) % totalSlides)
    setIsSliderPaused(true)
    window.setTimeout(() => setIsSliderPaused(false), leadershipSettings.delaySeconds * 1000)
  }

  const goToPreviousSlide = () => {
    if (!hasMultipleSlides) return
    setActiveSlideIndex((current) => (current - 1 + totalSlides) % totalSlides)
    setIsSliderPaused(true)
    window.setTimeout(() => setIsSliderPaused(false), leadershipSettings.delaySeconds * 1000)
  }

  const jumpToSlide = (index: number) => {
    setActiveSlideIndex(index)
    setIsSliderPaused(true)
    window.setTimeout(() => setIsSliderPaused(false), leadershipSettings.delaySeconds * 1000)
  }

  useGSAP(() => {
    if (!sectionRef.current || team.length === 0) return

    if (headerRef.current) {
      const els = headerRef.current.querySelectorAll('.reveal-item')
      gsap.fromTo(
        els,
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
  }, { scope: sectionRef, dependencies: [team] })

  useGSAP(() => {
    if (!cardsRef.current || activeSlideMembers.length === 0) return

    const cards = cardsRef.current.querySelectorAll('.team-card')
    const timeline = gsap.timeline()

    timeline.fromTo(
      cardsRef.current,
      { opacity: 0, x: 18 },
      {
        opacity: 1,
        x: 0,
        duration: 0.55,
        ease: 'power2.out'
      }
    )

    timeline.fromTo(
      cards,
      { opacity: 0, y: 18, scale: 0.985 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.045,
        ease: 'power3.out'
      },
      0.05
    )
  }, { scope: cardsRef, dependencies: [activeSlideIndex, activeSlideMembers.length] })

  return (
    <section
      id="management"
      ref={sectionRef}
      className="bg-dark-surface relative z-10 min-h-screen py-16 md:py-[120px]"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div ref={headerRef} className="text-center mb-12 md:mb-16">
          <span className="reveal-item section-label section-label-dark" style={{ color: '#C5A059' }}>
            LEADERSHIP
          </span>
          <h2 className="reveal-item font-display font-medium text-[36px] md:text-[64px] text-white leading-[1.1] tracking-[-0.025em] mt-4">
            The People Behind the Products
          </h2>
          <p className="reveal-item font-body text-lg md:text-xl text-white/60 leading-relaxed mt-4 max-w-[600px] mx-auto">
            Three decades of industry expertise, united by a commitment to quality and service.
          </p>
        </div>

        <div
          className="space-y-8"
          onMouseEnter={() => hasMultipleSlides && setIsSliderPaused(true)}
          onMouseLeave={() => hasMultipleSlides && setIsSliderPaused(false)}
        >
          <div
            ref={cardsRef}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
          >
            {activeSlideMembers.map((member) => {
              const hasBio = Boolean(member.bio?.trim())

              return (
                <div
                  key={member._id}
                  onClick={() => hasBio && setSelectedMember(member)}
                  className={`team-card bg-white/[0.03] border border-white/[0.05] overflow-hidden group transition-all duration-500 hover:border-brass/30 ${hasBio ? 'cursor-pointer hover:bg-white/[0.05]' : 'cursor-default'}`}
                >
                  <div className="grid min-h-full grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[100px_minmax(0,1fr)] lg:grid-cols-[110px_minmax(0,1fr)]">
                    <div className="relative h-full min-h-[136px] overflow-hidden bg-white/[0.03] sm:min-h-[144px] lg:min-h-[148px]">
                      <img
                        src={resolveMediaUrl(member.image)}
                        alt={member.name}
                        className="w-full h-full object-cover grayscale transition-all duration-[800ms] group-hover:grayscale-0 group-hover:scale-[1.05]"
                      />
                    </div>

                    <div className="flex min-h-[136px] flex-col justify-between p-3.5 sm:min-h-[144px] sm:p-4 lg:min-h-[148px] lg:p-4">
                      <div>
                        <span className="inline-block font-body font-bold text-[9px] uppercase tracking-[0.15em] text-brass mb-2">
                          {member.role}
                        </span>
                        <h3 className="font-display font-medium text-[16px] sm:text-[18px] lg:text-[19px] text-white tracking-tight leading-tight">
                          {member.name}
                        </h3>
                      </div>

                      {hasBio ? (
                        <p className="mt-2 text-[8px] text-white/30 uppercase font-bold tracking-widest group-hover:text-brass transition-colors flex items-center gap-1.5">
                          Read Profile <span className="text-sm">→</span>
                        </p>
                      ) : (
                        <p className="mt-2 text-[8px] text-white/20 uppercase font-bold tracking-widest">
                          Leadership Team
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMultipleSlides && (
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToPreviousSlide}
                  className="w-11 h-11 rounded-full border border-white/10 text-white flex items-center justify-center hover:border-brass hover:text-brass transition-colors"
                  aria-label="Previous leadership slide"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => jumpToSlide(index)}
                      className={`transition-all rounded-full ${
                        totalSlides <= 6
                          ? activeSlideIndex === index
                            ? 'w-9 h-2.5 bg-brass'
                            : 'w-2.5 h-2.5 bg-white/25 hover:bg-white/45'
                          : activeSlideIndex === index
                            ? 'px-3.5 h-8 bg-brass text-charcoal text-[10px] font-bold'
                            : 'px-3 h-8 border border-white/10 text-white/65 text-[10px] font-bold hover:border-brass'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    >
                      {totalSlides > 6 ? index + 1 : ''}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={goToNextSlide}
                  className="w-11 h-11 rounded-full border border-white/10 text-white flex items-center justify-center hover:border-brass hover:text-brass transition-colors"
                  aria-label="Next leadership slide"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <p className="text-[10px] uppercase tracking-[0.28em] text-white/25 font-bold">
                Slide {activeSlideIndex + 1} of {totalSlides}
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 pt-24 md:p-8 md:pt-28">
          <div
            className="absolute inset-0 bg-charcoal/95 backdrop-blur-md"
            onClick={() => setSelectedMember(null)}
          />

          <div
            data-lenis-prevent
            className="relative bg-[#171717] border border-white/10 w-full max-w-5xl h-[min(78vh,720px)] overflow-hidden grid grid-rows-[200px_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[300px_minmax(0,1fr)] shadow-[0_30px_80px_rgba(0,0,0,0.45)] animate-in fade-in zoom-in duration-300 rounded-[20px]"
          >
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-5 right-5 z-10 w-10 h-10 border border-white/10 bg-black/20 flex items-center justify-center text-white hover:bg-white/10 transition-all rounded-full"
            >
              ✕
            </button>

            <div className="bg-warm-stone/5 h-full min-h-0 overflow-hidden md:border-r md:border-white/5">
              <img
                src={resolveMediaUrl(selectedMember.image)}
                alt={selectedMember.name}
                className="w-full h-full object-cover object-center grayscale"
              />
            </div>

            <div
              ref={modalScrollRef}
              data-lenis-prevent
              className="min-h-0 overflow-y-auto overscroll-contain modal-scrollbar px-6 py-6 md:px-10 md:py-10 pr-5 md:pr-6"
            >
              <span className="text-[10px] font-bold text-brass uppercase tracking-[0.28em] mb-3 block">
                Executive Profile
              </span>
              <h3 className="font-display text-[28px] md:text-[46px] text-white tracking-[-0.03em] font-medium mb-2 leading-[1.02]">
                {selectedMember.name}
              </h3>
              <p className="text-[14px] md:text-[16px] text-white/80 font-body mb-6 uppercase tracking-[0.08em]">
                {selectedMember.role}
              </p>

              <div className="space-y-4 max-w-2xl">
                {selectedMember.bio?.trim().split('\n\n').map((para, index) => (
                  <p key={index} className="text-white/95 font-body leading-[1.75] text-[14px] md:text-[15px]">
                    {para}
                  </p>
                ))}
              </div>

              <div className="mt-8 pt-5 border-t border-white/5 max-w-2xl">
                <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold">
                  Bestworth Products Limited • Leadership Board
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
