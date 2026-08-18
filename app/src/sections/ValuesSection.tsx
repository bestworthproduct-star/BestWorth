import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  HandHeart,
  Leaf,
  Shield,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'

interface Value {
  title: string
  description: string
  icon: string
}

interface ContentChangePayload {
  key?: string
  data?: unknown
}

interface ValuesSliderSettings {
  autoSlide: boolean
  delaySeconds: number
}

const DEFAULT_VALUES_SLIDER_SETTINGS: ValuesSliderSettings = {
  autoSlide: true,
  delaySeconds: 15,
}

const iconMap: Record<string, LucideIcon> = {
  Shield,
  Target,
  Briefcase,
  HandHeart,
  Leaf,
}

const getCardsPerSlide = (width: number) => {
  if (width < 640) return 1
  if (width < 1024) return 2
  return 3
}

const formatNumber = (value: number) => String(value).padStart(2, '0')

const normalizeSliderSettings = (data?: Partial<ValuesSliderSettings> | null): ValuesSliderSettings => {
  const parsedDelay = Number(data?.delaySeconds)
  return {
    autoSlide: data?.autoSlide !== false,
    delaySeconds: Number.isFinite(parsedDelay) && parsedDelay >= 5
      ? parsedDelay
      : DEFAULT_VALUES_SLIDER_SETTINGS.delaySeconds,
  }
}

export default function ValuesSection() {
  const [values, setValues] = useState<Value[]>([])
  const [cardsPerSlide, setCardsPerSlide] = useState(() =>
    getCardsPerSlide(typeof window === 'undefined' ? 1280 : window.innerWidth)
  )
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [sliderSettings, setSliderSettings] = useState(DEFAULT_VALUES_SLIDER_SETTINGS)
  const [isAutoSlidePaused, setIsAutoSlidePaused] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const interactionResumeTimeoutRef = useRef<number | null>(null)

  const fetchValues = useCallback(() => {
    fetch(apiUrl('/api/content/values'))
      .then((response) => response.json())
      .then((data) => setValues(Array.isArray(data) ? data : []))
      .catch((error) => console.error('Failed to load company values:', error))
  }, [])

  const fetchSliderSettings = useCallback(() => {
    fetch(apiUrl('/api/content/values_settings'))
      .then((response) => response.ok ? response.json() : DEFAULT_VALUES_SLIDER_SETTINGS)
      .then((data) => setSliderSettings(normalizeSliderSettings(data)))
      .catch(() => setSliderSettings(DEFAULT_VALUES_SLIDER_SETTINGS))
  }, [])

  useEffect(() => {
    fetchValues()
    fetchSliderSettings()
  }, [fetchSliderSettings, fetchValues])

  useEffect(() => () => {
    if (interactionResumeTimeoutRef.current !== null) {
      window.clearTimeout(interactionResumeTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => setCardsPerSlide(getCardsPerSlide(window.innerWidth))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useSocket('content_change', useCallback((payload: ContentChangePayload) => {
    if (payload.key === 'values') {
      setValues(Array.isArray(payload.data) ? payload.data as Value[] : [])
    }
    if (payload.key === 'values_settings') {
      setSliderSettings(normalizeSliderSettings(payload.data as Partial<ValuesSliderSettings>))
    }
  }, []))

  const slides = useMemo(() => {
    const preparedSlides: Value[][] = []
    for (let index = 0; index < values.length; index += cardsPerSlide) {
      preparedSlides.push(values.slice(index, index + cardsPerSlide))
    }
    return preparedSlides
  }, [cardsPerSlide, values])

  const totalSlides = slides.length
  const safeActiveSlideIndex = Math.min(activeSlideIndex, Math.max(totalSlides - 1, 0))
  const activeValues = slides[safeActiveSlideIndex] || []
  const hasMultipleSlides = totalSlides > 1

  // Handle auto-slide timing
  useEffect(() => {
    if (!hasMultipleSlides || !sliderSettings.autoSlide || isAutoSlidePaused) return

    const timeout = window.setTimeout(() => {
      setActiveSlideIndex((current) => (current + 1) % totalSlides)
    }, sliderSettings.delaySeconds * 1000)

    return () => window.clearTimeout(timeout)
  }, [hasMultipleSlides, isAutoSlidePaused, sliderSettings.autoSlide, sliderSettings.delaySeconds, totalSlides])

  const pauseAutoSlideTemporarily = () => {
    setIsAutoSlidePaused(true)
    if (interactionResumeTimeoutRef.current !== null) {
      window.clearTimeout(interactionResumeTimeoutRef.current)
    }
    interactionResumeTimeoutRef.current = window.setTimeout(() => {
      setIsAutoSlidePaused(false)
      interactionResumeTimeoutRef.current = null
    }, sliderSettings.delaySeconds * 1000)
  }

  const goToSlide = (index: number) => {
    if (!hasMultipleSlides) return
    const newIndex = (index + totalSlides) % totalSlides
    setActiveSlideIndex(newIndex)
    pauseAutoSlideTemporarily()

    // If on mobile, also scroll the container
    if (cardsPerSlide === 1 && scrollContainerRef.current) {
      const card = scrollContainerRef.current.children[newIndex] as HTMLElement
      if (card) {
        scrollContainerRef.current.scrollTo({
          left: card.offsetLeft - (scrollContainerRef.current.offsetWidth - card.offsetWidth) / 2,
          behavior: 'smooth'
        })
      }
    }
  }

  const goToPreviousSlide = () => goToSlide(safeActiveSlideIndex - 1)
  const goToNextSlide = () => goToSlide(safeActiveSlideIndex + 1)

  // Handle mobile scroll sync
  const handleMobileScroll = useCallback(() => {
    if (cardsPerSlide !== 1 || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const scrollLeft = container.scrollLeft
    const containerWidth = container.offsetWidth
    const centerX = scrollLeft + containerWidth / 2

    let closestIndex = 0
    let minDistance = Infinity

    Array.from(container.children).forEach((child, index) => {
      const card = child as HTMLElement
      const cardCenter = card.offsetLeft + card.offsetWidth / 2
      const distance = Math.abs(centerX - cardCenter)

      if (distance < minDistance) {
        minDistance = distance
        closestIndex = index
      }

      // Dynamic scaling for focus effect
      const relativeDistance = Math.min(1, distance / (containerWidth / 2))
      const scale = 1.05 - (relativeDistance * 0.1) // From 1.05 down to 0.95
      const opacity = 1 - (relativeDistance * 0.4) // From 1 down to 0.6

      gsap.to(card, {
        scale,
        opacity,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    })

    if (closestIndex !== activeSlideIndex) {
      setActiveSlideIndex(closestIndex)
    }
  }, [activeSlideIndex, cardsPerSlide])

  // Manual scroll detection to pause auto-slide
  const handleTouchStart = () => {
    setIsAutoSlidePaused(true)
  }

  const handleTouchEnd = () => {
    pauseAutoSlideTemporarily()
  }

  // Sync auto-slide with mobile scroll
  useEffect(() => {
    if (cardsPerSlide === 1 && scrollContainerRef.current && !isAutoSlidePaused) {
      const container = scrollContainerRef.current
      const targetCard = container.children[safeActiveSlideIndex] as HTMLElement
      if (targetCard) {
        container.scrollTo({
          left: targetCard.offsetLeft - (container.offsetWidth - targetCard.offsetWidth) / 2,
          behavior: 'smooth'
        })
      }
    }
  }, [safeActiveSlideIndex, cardsPerSlide, isAutoSlidePaused])

  useGSAP(() => {
    if (!headerRef.current || values.length === 0) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const headerElements = headerRef.current.querySelectorAll('.reveal-item')

    gsap.fromTo(
      headerElements,
      { opacity: 0, y: reduceMotion ? 0 : 40 },
      {
        opacity: 1,
        y: 0,
        duration: reduceMotion ? 0 : 0.9,
        stagger: reduceMotion ? 0 : 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: headerRef.current,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      }
    )
  }, { scope: sectionRef, dependencies: [values.length] })

  // Entrance animation for desktop
  useGSAP(() => {
    if (!cardsRef.current || cardsPerSlide === 1 || activeValues.length === 0) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cards = cardsRef.current.querySelectorAll('.value-card')

    gsap.fromTo(
      cards,
      { opacity: 0, x: reduceMotion ? 0 : 24, y: reduceMotion ? 0 : 12 },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: reduceMotion ? 0 : 0.55,
        stagger: reduceMotion ? 0 : 0.06,
        ease: 'power3.out',
      }
    )
  }, { scope: cardsRef, dependencies: [safeActiveSlideIndex, activeValues.length, cardsPerSlide] })

  if (values.length === 0) return null

  return (
    <section
      id="values"
      ref={sectionRef}
      className="relative z-10 flex min-h-screen items-center overflow-hidden bg-cream py-14 md:py-[100px]"
    >
      <div className="pointer-events-none absolute -right-28 top-20 h-72 w-72 rounded-full border border-charcoal/[0.06]" />
      <div className="pointer-events-none absolute -right-10 top-40 h-44 w-44 rounded-full border border-brass/10" />

      <div className="relative mx-auto w-full max-w-[1280px] px-0 md:px-10">
        <div ref={headerRef} className="mb-8 px-6 text-center md:mb-12 md:px-0">
          <span className="reveal-item section-label section-label-dark text-brass text-[12px]">
            OUR VALUES
          </span>
          <h2 className="reveal-item mt-3 font-display text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-charcoal md:text-[44px]">
            The Principles That Drive Us
          </h2>
          <p className="reveal-item mx-auto mt-4 max-w-2xl font-body text-[15px] leading-6 text-charcoal/60 md:text-[16px]">
            The standards behind every product, partnership, and decision we make.
          </p>
        </div>

        {/* Mobile Highlight Carousel (< 640px) */}
        {cardsPerSlide === 1 ? (
          <div
            ref={scrollContainerRef}
            onScroll={handleMobileScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={() => setIsAutoSlidePaused(true)}
            onMouseLeave={() => setIsAutoSlidePaused(false)}
            className="no-scrollbar flex w-full snap-x snap-mandatory items-center overflow-x-auto pb-10 pt-4"
            style={{ paddingLeft: '15%', paddingRight: '15%' }}
          >
            {values.map((value, index) => {
              const Icon = iconMap[value.icon] || Shield
              return (
                <article
                  key={`${value.title}-${index}`}
                  className="value-card relative mr-4 flex min-h-[340px] w-[70vw] flex-shrink-0 snap-center flex-col overflow-hidden rounded-lg border border-charcoal/10 border-t-4 border-t-brass bg-white p-7 shadow-[0_18px_55px_rgba(6,2,115,0.06)] transition-all duration-500 last:mr-0"
                >
                  <span className="pointer-events-none absolute -right-2 -top-7 font-display text-[108px] font-bold leading-none text-charcoal/[0.035]">
                    {formatNumber(index + 1)}
                  </span>
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center border border-brass/20 bg-brass/[0.06] text-brass">
                      <Icon size={28} strokeWidth={1.6} />
                    </div>
                    <span className="font-body text-[10px] font-bold tracking-[0.24em] text-charcoal/35">
                      {formatNumber(index + 1)}
                    </span>
                  </div>
                  <div className="relative mt-auto pt-10">
                    <div className="mb-4 h-px w-12 bg-brass" />
                    <h3 className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.015em] text-charcoal md:text-[26px]">
                      {value.title}
                    </h3>
                    <p className="mt-3 font-body text-[14px] leading-[1.65] text-charcoal/68 md:text-[15px]">
                      {value.description}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          /* Desktop/Tablet Grid Layout (>= 640px) */
          <div
            ref={cardsRef}
            onMouseEnter={() => setIsAutoSlidePaused(true)}
            onMouseLeave={() => setIsAutoSlidePaused(false)}
            className={`relative z-10 grid gap-6 lg:gap-8 ${
              cardsPerSlide === 2
                ? 'mx-auto max-w-[860px] grid-cols-2'
                : 'grid-cols-3'
            }`}
          >
            {activeValues.map((value, slidePosition) => {
              const Icon = iconMap[value.icon] || Shield
              const absoluteIndex = safeActiveSlideIndex * cardsPerSlide + slidePosition
              return (
                <article
                  key={`${value.title}-${absoluteIndex}`}
                  className="value-card group relative flex min-h-[360px] flex-col overflow-hidden rounded-lg border border-charcoal/10 border-t-4 border-t-brass bg-white p-9 shadow-[0_18px_55px_rgba(6,2,115,0.06)] transition-all duration-500 hover:-translate-y-1 hover:border-charcoal/25 hover:shadow-[0_24px_65px_rgba(6,2,115,0.11)] lg:p-10"
                >
                  <span className="pointer-events-none absolute -right-2 -top-7 font-display text-[132px] font-bold leading-none text-charcoal/[0.035]">
                    {formatNumber(absoluteIndex + 1)}
                  </span>
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center border border-brass/20 bg-brass/[0.06] text-brass transition-colors duration-300 group-hover:bg-brass group-hover:text-white">
                      <Icon size={28} strokeWidth={1.6} />
                    </div>
                    <span className="font-body text-[10px] font-bold tracking-[0.24em] text-charcoal/35">
                      {formatNumber(absoluteIndex + 1)}
                    </span>
                  </div>
                  <div className="relative mt-auto pt-10">
                    <div className="mb-4 h-px w-12 bg-brass transition-all duration-500 group-hover:w-20" />
                    <h3 className="font-display text-[26px] font-medium leading-[1.2] tracking-[-0.015em] text-charcoal">
                      {value.title}
                    </h3>
                    <p className="mt-3 font-body text-[15px] leading-[1.65] text-charcoal/68">
                      {value.description}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {hasMultipleSlides && (
          <div className="mt-8 flex flex-col items-center justify-between gap-5 border-t border-charcoal/10 px-6 pt-6 sm:flex-row sm:px-0">
            <div className="flex items-center gap-2" aria-label="Values pages">
              {(cardsPerSlide === 1 ? values : slides).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    safeActiveSlideIndex === index
                      ? 'w-9 bg-brass'
                      : 'w-2.5 bg-charcoal/20 hover:bg-charcoal/40'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-4">
              <span className="min-w-[68px] text-center font-body text-[10px] font-bold tracking-[0.22em] text-charcoal/45">
                {formatNumber(safeActiveSlideIndex + 1)} / {formatNumber(cardsPerSlide === 1 ? values.length : totalSlides)}
              </span>
              <button
                type="button"
                onClick={goToPreviousSlide}
                className="flex h-11 w-11 items-center justify-center border border-charcoal/15 text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goToNextSlide}
                className="flex h-11 w-11 items-center justify-center border border-charcoal bg-charcoal text-white transition-colors hover:border-brass hover:bg-brass"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
