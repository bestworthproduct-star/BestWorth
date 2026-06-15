import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

interface AboutData {
  title: string
  description: string[]
  imageUrl: string
}

export default function AboutSection() {
  const [aboutData, setAboutData] = useState<AboutData | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/about'))
      .then(res => res.json())
      .then(data => setAboutData(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'about') setAboutData(payload.data)
  })

  useGSAP(() => {
    if (!sectionRef.current || !aboutData) return

    // Parallax on image
    if (imageRef.current) {
      gsap.to(imageRef.current.querySelector('img'), {
        yPercent: -15,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })
    }

    // Image slide in from left
    gsap.fromTo(
      imageRef.current,
      { opacity: 0, x: -60 },
      {
        opacity: 1,
        x: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      }
    )

    // Text content reveal
    if (textRef.current) {
      const elements = textRef.current.querySelectorAll('.reveal-item')
      gsap.fromTo(
        elements,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: textRef.current,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      )
    }
  }, { scope: sectionRef, dependencies: [aboutData] })

  if (!aboutData) return null

  return (
    <section
      id="about"
      ref={sectionRef}
      className="bg-warm-stone relative z-10 min-h-screen flex items-center py-16 md:py-[120px]"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="flex flex-col md:flex-row gap-10 md:gap-16 items-center">
          {/* Left Column - Image with Parallax */}
          <div className="w-full md:w-[45%] overflow-hidden" ref={imageRef}>
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src={resolveMediaUrl(aboutData.imageUrl)}
                alt="Assorted nails and screws on concrete surface"
                className="w-full h-[120%] object-cover scale-110"
              />
            </div>
          </div>

          {/* Right Column - Text Content */}
          <div className="w-full md:w-[55%] md:py-10" ref={textRef}>
            <span className="reveal-item section-label section-label-light">
              ABOUT US
            </span>

            <h2 className="reveal-item font-display font-medium text-[28px] md:text-5xl text-charcoal leading-[1.1] tracking-[-0.02em] mt-4">
              {aboutData.title}
            </h2>

            {aboutData.description.map((para, i) => (
              <p key={i} className="reveal-item font-body text-base md:text-[17px] text-charcoal leading-[1.7] mt-6">
                {para}
              </p>
            ))}

            <button
              className="reveal-item btn-secondary mt-10"
              onClick={() => {
                const el = document.getElementById('contact')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              LEARN MORE
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
