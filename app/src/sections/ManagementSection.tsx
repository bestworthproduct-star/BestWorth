import { useRef, useEffect, useState, useCallback } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
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

export default function ManagementSection() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  const fetchTeam = useCallback(() => {
    fetch(apiUrl('/api/team'))
      .then(res => res.json())
      .then(data => setTeam(data))
      .catch(err => console.error('Error fetching team:', err))
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  useSocket('team_change', fetchTeam)

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

    if (cardsRef.current) {
      const cards = cardsRef.current.querySelectorAll('.team-card')
      gsap.fromTo(
        cards,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
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
  }, { scope: sectionRef, dependencies: [team] })

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
          ref={cardsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
        >
          {team.map((member) => {
            const hasBio = Boolean(member.bio?.trim())

            return (
              <div
                key={member._id}
                onClick={() => hasBio && setSelectedMember(member)}
                className={`team-card bg-white/[0.03] border border-white/[0.05] overflow-hidden group transition-all duration-500 hover:border-brass/30 ${hasBio ? 'cursor-pointer hover:bg-white/[0.05]' : 'cursor-default'}`}
              >
                <div className="aspect-[4/4.4] overflow-hidden relative">
                  <img
                    src={resolveMediaUrl(member.image)}
                    alt={member.name}
                    className="w-full h-full object-cover grayscale transition-all duration-[800ms] group-hover:grayscale-0 group-hover:scale-[1.05]"
                  />
                  {hasBio && (
                    <div className="absolute inset-0 bg-charcoal/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold uppercase tracking-[0.3em] border border-white/20 px-4 py-2 backdrop-blur-sm">
                        View Biography
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-7 min-h-[170px] flex flex-col justify-between">
                  <div>
                    <span className="inline-block font-body font-bold text-[10px] uppercase tracking-[0.15em] text-brass mb-3">
                      {member.role}
                    </span>
                    <h3 className="font-display font-medium text-[24px] text-white tracking-tight leading-tight">
                      {member.name}
                    </h3>
                  </div>

                  {hasBio ? (
                    <p className="text-[11px] text-white/30 uppercase font-bold tracking-widest mt-5 group-hover:text-brass transition-colors flex items-center gap-2">
                      Read Profile <span className="text-lg">→</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-white/20 uppercase font-bold tracking-widest mt-5">
                      Leadership Team
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 md:p-12">
          <div
            className="absolute inset-0 bg-charcoal/95 backdrop-blur-md"
            onClick={() => setSelectedMember(null)}
          />

          <div className="relative bg-[#1A1A1A] border border-white/10 w-full max-w-5xl max-h-[88vh] overflow-hidden grid md:grid-cols-[minmax(280px,340px)_1fr] shadow-2xl animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-6 right-6 z-10 w-10 h-10 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all rounded-full"
            >
              ✕
            </button>

            <div className="bg-warm-stone/5 max-h-[320px] md:max-h-none">
              <img
                src={resolveMediaUrl(selectedMember.image)}
                alt={selectedMember.name}
                className="w-full h-full object-cover grayscale"
              />
            </div>

            <div className="p-8 md:p-12 overflow-y-auto">
              <span className="text-[10px] font-bold text-brass uppercase tracking-[0.3em] mb-4 block">
                Executive Profile
              </span>
              <h3 className="font-display text-3xl md:text-5xl text-white tracking-tight font-medium mb-2">
                {selectedMember.name}
              </h3>
              <p className="text-base md:text-lg text-white/60 font-body mb-8">
                {selectedMember.role}
              </p>

              <div className="space-y-5 max-w-2xl">
                {selectedMember.bio?.trim().split('\n\n').map((para, index) => (
                  <p key={index} className="text-white/80 font-body leading-[1.85] text-[15px] md:text-[17px]">
                    {para}
                  </p>
                ))}
              </div>

              <div className="mt-10 pt-6 border-t border-white/5">
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
