import { useRef, useEffect, useMemo, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { isExternalMediaUrl, useCookieConsent } from '@/lib/cookie-consent'

interface HeroSectionProps {
  scrollTo: (target: string) => void
}

interface HeroData {
  title: string
  subtitle: string
  buttonText: string
  videoUrls?: string[]
  mediaItems?: HeroMediaItem[]
  establishmentDate?: string
  idleHideDelaySeconds?: number | null
}

interface HeroMediaItem {
  type: 'video' | 'image'
  url: string
  imageDurationSeconds?: number
}

const HERO_IDLE_HIDE_FALLBACK_SECONDS = 25

function resolveHeroIdleDelaySeconds(value?: number | null) {
  if (value === null) {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(15, value)
  }

  return HERO_IDLE_HIDE_FALLBACK_SECONDS
}

export default function HeroSection({ scrollTo }: HeroSectionProps) {
  const [heroData, setHeroData] = useState<HeroData | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isHeroActive, setIsHeroActive] = useState(true)
  const [isPageVisible, setIsPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  const consent = useCookieConsent()
  const mediaItems = useMemo<HeroMediaItem[]>(() => {
    const configuredItems = Array.isArray(heroData?.mediaItems)
      ? heroData.mediaItems
      : (heroData?.videoUrls || []).map((url) => ({ type: 'video' as const, url }))
    const permittedItems = configuredItems.filter((item) => (
      item &&
      (item.type === 'video' || item.type === 'image') &&
      typeof item.url === 'string' &&
      item.url.trim() &&
      (consent?.externalMedia || !isExternalMediaUrl(resolveMediaUrl(item.url)))
    ))
    return permittedItems.length
      ? permittedItems
      : [{ type: 'video', url: '/assets/Hero-Video.mp4' }]
  }, [consent?.externalMedia, heroData])
  const heroRef = useRef<HTMLElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentWrapRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const idleTimeoutRef = useRef<number | null>(null)
  const idleHiddenRef = useRef(false)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const previousSlideRef = useRef(0)
  const videoFallbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/hero'))
      .then(res => res.json())
      .then(data => setHeroData(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'hero') setHeroData(payload.data)
  })

  useEffect(() => {
    if (!heroRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroActive(entry.isIntersecting && entry.intersectionRatio >= 0.55)
      },
      { threshold: [0.3, 0.55, 0.8] }
    )

    observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => setIsPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (currentSlideIndex < mediaItems.length) return
    const resetTimer = window.setTimeout(() => setCurrentSlideIndex(0), 0)
    return () => window.clearTimeout(resetTimer)
  }, [currentSlideIndex, mediaItems.length])

  useEffect(() => {
    const slideChanged = previousSlideRef.current !== currentSlideIndex
    if (!isHeroActive || !isPageVisible) {
      if (videoFallbackTimerRef.current) window.clearTimeout(videoFallbackTimerRef.current)
      videoFallbackTimerRef.current = null
    }
    videoRefs.current.forEach((video, index) => {
      if (!video) return
      if (index !== currentSlideIndex) {
        video.pause()
        if (video.currentTime !== 0) video.currentTime = 0
        return
      }
      if (slideChanged && video.currentTime !== 0) video.currentTime = 0
      if (isHeroActive && isPageVisible) {
        void video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
    previousSlideRef.current = currentSlideIndex
  }, [currentSlideIndex, isHeroActive, isPageVisible, mediaItems])

  useEffect(() => {
    if (!isHeroActive || !isPageVisible || mediaItems.length <= 1) return
    const activeItem = mediaItems[currentSlideIndex]
    if (!activeItem || activeItem.type !== 'image') return
    const duration = Number.isInteger(activeItem.imageDurationSeconds)
      ? Math.min(60, Math.max(3, activeItem.imageDurationSeconds || 8))
      : 8
    const imageTimer = window.setTimeout(() => {
      setCurrentSlideIndex((current) => (current + 1) % mediaItems.length)
    }, duration * 1000)
    return () => window.clearTimeout(imageTimer)
  }, [currentSlideIndex, isHeroActive, isPageVisible, mediaItems])

  useEffect(() => () => {
    if (videoFallbackTimerRef.current) window.clearTimeout(videoFallbackTimerRef.current)
  }, [])

  const clearVideoFallback = () => {
    if (videoFallbackTimerRef.current) {
      window.clearTimeout(videoFallbackTimerRef.current)
      videoFallbackTimerRef.current = null
    }
  }

  const scheduleVideoFallback = (index: number, delay = 15000) => {
    if (!isHeroActive || !isPageVisible || mediaItems.length <= 1 || index !== currentSlideIndex) return
    if (videoFallbackTimerRef.current) return
    videoFallbackTimerRef.current = window.setTimeout(() => {
      videoFallbackTimerRef.current = null
      setCurrentSlideIndex((current) => current === index ? (current + 1) % mediaItems.length : current)
    }, delay)
  }

  const showNextSlide = () => {
    clearVideoFallback()
    if (mediaItems.length > 1) {
      setCurrentSlideIndex((current) => (current + 1) % mediaItems.length)
    }
  }

  const nextSlide = () => {
    clearVideoFallback()
    setCurrentSlideIndex((current) => (current + 1) % mediaItems.length)
  }

  const prevSlide = () => {
    clearVideoFallback()
    setCurrentSlideIndex((current) => (current - 1 + mediaItems.length) % mediaItems.length)
  }

  const handleExploreCatalog = () => {
    const productsSection = document.getElementById('products')

    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    scrollTo('#products')
  }

  useGSAP(() => {
    if (!heroData) return
    const tl = gsap.timeline({ delay: 0.3 })

    // Label fade in
    tl.fromTo(
      labelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
      0.2
    )

    // Headline words reveal
    if (headlineRef.current) {
      const words = headlineRef.current.querySelectorAll('.word-wrap')
      tl.fromTo(
        words,
        { yPercent: 100 },
        { yPercent: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' },
        0.3
      )
    }

    // Subtitle and CTA fade in
    tl.fromTo(
      subtitleRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      0.8
    )
    tl.fromTo(
      ctaRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      0.85
    )
  }, { scope: heroRef, dependencies: [heroData] })

  useEffect(() => {
    const heroElement = heroRef.current
    const contentElement = contentWrapRef.current
    const overlayElement = overlayRef.current

    if (!heroElement || !contentElement || !overlayElement) return
    if (!isHeroActive) {
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
      idleHiddenRef.current = false
      gsap.to(contentElement, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', overwrite: true })
      gsap.to(overlayElement, { opacity: 1, duration: 0.25, ease: 'power2.out', overwrite: true })
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches

    if (prefersReducedMotion || isMobileViewport) {
      return
    }

    const idleDelaySeconds = resolveHeroIdleDelaySeconds(heroData?.idleHideDelaySeconds)

    if (idleDelaySeconds === null) {
      return
    }

    const hideHeroContent = () => {
      idleHiddenRef.current = true
      gsap.to(contentElement, {
        opacity: 0,
        y: 18,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: true
      })
      gsap.to(overlayElement, {
        opacity: 0.45,
        duration: 1,
        ease: 'power2.out',
        overwrite: true
      })
    }

    const showHeroContent = () => {
      const shouldAnimate = idleHiddenRef.current
      idleHiddenRef.current = false
      gsap.to(contentElement, {
        opacity: 1,
        y: 0,
        duration: shouldAnimate ? 0.28 : 0.18,
        ease: 'power2.out',
        overwrite: true
      })
      gsap.to(overlayElement, {
        opacity: 1,
        duration: shouldAnimate ? 0.28 : 0.18,
        ease: 'power2.out',
        overwrite: true
      })
    }

    const scheduleIdleHide = () => {
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current)
      }
      idleTimeoutRef.current = window.setTimeout(hideHeroContent, idleDelaySeconds * 1000)
    }

    const handleInteraction = () => {
      showHeroContent()
      scheduleIdleHide()
    }

    scheduleIdleHide()

    heroElement.addEventListener('mouseenter', handleInteraction)
    heroElement.addEventListener('mousemove', handleInteraction)
    heroElement.addEventListener('touchstart', handleInteraction, { passive: true })
    heroElement.addEventListener('focusin', handleInteraction)
    window.addEventListener('scroll', handleInteraction, { passive: true })

    return () => {
      heroElement.removeEventListener('mouseenter', handleInteraction)
      heroElement.removeEventListener('mousemove', handleInteraction)
      heroElement.removeEventListener('touchstart', handleInteraction)
      heroElement.removeEventListener('focusin', handleInteraction)
      window.removeEventListener('scroll', handleInteraction)
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
      idleHiddenRef.current = false
      gsap.to(contentElement, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', overwrite: true })
      gsap.to(overlayElement, { opacity: 1, duration: 0.2, ease: 'power2.out', overwrite: true })
    }
  }, [isHeroActive, heroData])

  const headlineWords = (heroData?.title || 'THE STANDARD IN FASTENERS').split(' ')

  if (!heroData) return (
    <section id="hero" className="min-h-screen bg-charcoal flex items-center justify-center">
       <div className="w-12 h-12 border-2 border-white/10 border-t-[#D64545] rounded-full animate-spin"></div>
    </section>
  )

  return (
    <section
      id="hero"
      ref={heroRef}
      className="sticky top-0 h-screen w-full flex items-center overflow-hidden z-[1]"
    >
      {/* Hero Media Background */}
      <div className="absolute inset-0 w-full h-full z-[1]">
        {mediaItems.map((item, idx) => item.type === 'image' ? (
          <img
            key={`${item.type}-${item.url}-${idx}`}
            src={resolveMediaUrl(item.url)}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${idx === currentSlideIndex ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <video
            key={`${item.type}-${item.url}-${idx}`}
            ref={(element) => { videoRefs.current[idx] = element }}
            autoPlay={idx === currentSlideIndex && isHeroActive && isPageVisible}
            muted
            loop={mediaItems.length === 1}
            playsInline
            preload={idx === currentSlideIndex ? 'auto' : 'metadata'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${idx === currentSlideIndex ? 'opacity-100' : 'opacity-0'}`}
            poster={resolveMediaUrl('/assets/about-hero.jpg')}
            onPlaying={() => { if (idx === currentSlideIndex) clearVideoFallback() }}
            onWaiting={() => scheduleVideoFallback(idx)}
            onStalled={() => scheduleVideoFallback(idx)}
            onError={() => scheduleVideoFallback(idx, 3000)}
            onEnded={() => { if (idx === currentSlideIndex) showNextSlide() }}
          >
            <source src={resolveMediaUrl(item.url)} />
          </video>
        ))}
      </div>

      {/* Gradient Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 z-[2]"
        style={{
          background: 'linear-gradient(180deg, rgba(10,34,64,0.3) 0%, rgba(10,34,64,0.72) 100%)',
        }}
      />

      {/* Content */}
      <div ref={contentWrapRef} className="relative z-[3] px-6 md:px-20 py-20 max-w-[900px] will-change-transform">
        <span
          ref={labelRef}
          className="section-label section-label-dark opacity-0"
          style={{ color: '#FFFFFF', textShadow: '0 2px 12px rgba(0, 0, 0, 0.38)' }}
        >
          {heroData.establishmentDate || 'EST. 1987'}
        </span>

        <h1
          ref={headlineRef}
          className="font-display font-bold text-[32px] md:text-[60px] text-white leading-[1.1] tracking-[-0.02em] mt-4 overflow-hidden max-w-[800px]"
        >
          {headlineWords.map((word, i) => (
            <span key={i} className="inline-block overflow-hidden mr-[0.25em]">
              <span className="word-wrap inline-block">{word}</span>
            </span>
          ))}
        </h1>

        <div ref={subtitleRef} className="opacity-0 mt-6">
          <p className="font-body text-[17px] md:text-xl text-white/70 max-w-[540px] leading-relaxed">
            {heroData.subtitle}
          </p>
        </div>

        <button
          type="button"
          ref={ctaRef}
          onClick={handleExploreCatalog}
          className="btn-primary mt-10 opacity-0 pointer-events-auto relative z-[5]"
        >
          {heroData.buttonText}
        </button>
      </div>

      {/* Navigation Arrows */}
      {mediaItems.length > 1 && (
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 md:px-10 z-[4] pointer-events-none">
          <button 
            onClick={prevSlide}
            className="p-3 rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white transition-all bg-charcoal/20 backdrop-blur-sm pointer-events-auto"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={nextSlide}
            className="p-3 rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white transition-all bg-charcoal/20 backdrop-blur-sm pointer-events-auto"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[3] animate-bounce-slow">
        <ChevronDown size={24} className="text-white/70" />
      </div>

      {/* Slide Indicators */}
      {mediaItems.length > 1 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-[4]">
          {mediaItems.map((item, idx) => (
            <button
              key={`${item.type}-${item.url}-${idx}`}
              aria-label={`Show hero slide ${idx + 1}`}
              onClick={() => { clearVideoFallback(); setCurrentSlideIndex(idx) }}
              className={`h-1 transition-all duration-500 ${
                idx === currentSlideIndex ? 'w-8 bg-brass' : 'w-4 bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
