import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'

interface HeroSectionProps {
  scrollTo: (target: string) => void
}

interface HeroData {
  title: string
  subtitle: string
  buttonText: string
  videoUrls: string[]
  establishmentDate?: string
}

export default function HeroSection({ scrollTo }: HeroSectionProps) {
  const [heroData, setHeroData] = useState<HeroData | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const heroRef = useRef<HTMLElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/hero'))
      .then(res => res.json())
      .then(data => setHeroData(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'hero') setHeroData(payload.data)
  })

  // Auto-slide effect
  useEffect(() => {
    if (!heroData?.videoUrls || heroData.videoUrls.length <= 1) return

    const interval = setInterval(() => {
      setCurrentVideoIndex((prev) => (prev + 1) % heroData.videoUrls.length)
    }, 8000) // 8 seconds per slide

    return () => clearInterval(interval)
  }, [heroData?.videoUrls])

  const nextVideo = () => {
    if (heroData?.videoUrls) {
      setCurrentVideoIndex((prev) => (prev + 1) % heroData.videoUrls.length)
    }
  }

  const prevVideo = () => {
    if (heroData?.videoUrls) {
      setCurrentVideoIndex((prev) => (prev - 1 + heroData.videoUrls.length) % heroData.videoUrls.length)
    }
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

  const headlineWords = (heroData?.title || 'THE STANDARD IN FASTENERS').split(' ')

  if (!heroData) return (
    <section id="hero" className="min-h-screen bg-charcoal flex items-center justify-center">
       <div className="w-12 h-12 border-2 border-white/5 border-t-brass rounded-full animate-spin"></div>
    </section>
  )

  const currentVideo = heroData.videoUrls?.[currentVideoIndex] || '/assets/Hero-Video.mp4'

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-full z-[1]">
        {heroData.videoUrls?.map((url, idx) => (
          <video
            key={url + idx}
            autoPlay
            muted
            loop
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              idx === currentVideoIndex ? 'opacity-100' : 'opacity-0'
            }`}
            poster="/assets/about-hero.jpg"
          >
            <source src={url} type="video/mp4" />
          </video>
        ))}
        {!heroData.videoUrls?.length && (
           <video
           autoPlay
           muted
           loop
           playsInline
           className="absolute inset-0 w-full h-full object-cover"
           poster="/assets/about-hero.jpg"
         >
           <source src="/assets/Hero-Video.mp4" type="video/mp4" />
         </video>
        )}
      </div>

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background: 'linear-gradient(180deg, rgba(43,43,43,0.3) 0%, rgba(43,43,43,0.6) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-[3] px-6 md:px-20 py-20 max-w-[900px]">
        <span
          ref={labelRef}
          className="section-label section-label-dark opacity-0"
          style={{ color: '#B8860B' }}
        >
          {heroData.establishmentDate || 'EST. 1987'}
        </span>

        <h1
          ref={headlineRef}
          className="font-display font-bold text-[42px] md:text-[90px] text-white leading-[0.95] tracking-[-0.03em] mt-4 overflow-hidden"
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
          ref={ctaRef}
          onClick={() => scrollTo('#products')}
          className="btn-primary mt-10 opacity-0"
        >
          {heroData.buttonText}
        </button>
      </div>

      {/* Navigation Arrows */}
      {heroData.videoUrls && heroData.videoUrls.length > 1 && (
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 md:px-10 z-[4]">
          <button 
            onClick={prevVideo}
            className="p-3 rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white transition-all bg-charcoal/20 backdrop-blur-sm"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={nextVideo}
            className="p-3 rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white transition-all bg-charcoal/20 backdrop-blur-sm"
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
      {heroData.videoUrls && heroData.videoUrls.length > 1 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-[4]">
          {heroData.videoUrls.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentVideoIndex(idx)}
              className={`h-1 transition-all duration-500 ${
                idx === currentVideoIndex ? 'w-8 bg-brass' : 'w-4 bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
