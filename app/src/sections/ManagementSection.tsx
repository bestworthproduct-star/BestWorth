import { useRef, useEffect, useState, useCallback } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useSocket } from '../hooks/useSocket'

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
    fetch('http://localhost:5000/api/team')
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

    // Header animation
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

    // Cards stagger
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
        {/* Header */}
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

        {/* Team Grid */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
        >
          {team.map((member) => (
            <div
              key={member._id}
              onClick={() => member.bio && setSelectedMember(member)}
              className={`team-card bg-white/[0.03] border border-white/[0.05] overflow-hidden group transition-all duration-500 hover:border-brass/30 ${member.bio ? 'cursor-pointer hover:bg-white/[0.05]' : 'cursor-default'}`}
            >
              {/* Portrait */}
              <div className="aspect-[4/5] overflow-hidden relative">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover grayscale transition-all duration-[800ms] group-hover:grayscale-0 group-hover:scale-[1.05]"
                />
                {member.bio && (
                  <div className="absolute inset-0 bg-charcoal/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold uppercase tracking-[0.3em] border border-white/20 px-4 py-2 backdrop-blur-sm">View Biography</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-8">
                <span className="inline-block font-body font-bold text-[10px] uppercase tracking-[0.15em] text-brass mb-3">
                  {member.role}
                </span>
                <h3 className="font-display font-medium text-2xl text-white tracking-tight">
                  {member.name}
                </h3>
                {member.bio && (
                  <p className="text-[11px] text-white/30 uppercase font-bold tracking-widest mt-4 group-hover:text-brass transition-colors flex items-center gap-2">
                    Read Story <span className="text-lg">→</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Biography Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 md:p-12">
          <div
            className="absolute inset-0 bg-charcoal/95 backdrop-blur-md"
            onClick={() => setSelectedMember(null)}
          ></div>

          <div className="relative bg-[#1A1A1A] border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Close Button */}
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-6 right-6 z-10 w-10 h-10 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all rounded-full"
            >
              ✕
            </button>

            {/* Image Column */}
            <div className="w-full md:w-[40%] bg-warm-stone/5">
              <img
                src={selectedMember.image}
                alt={selectedMember.name}
                className="w-full h-full object-cover grayscale"
              />
            </div>

            {/* Content Column */}
            <div className="w-full md:w-[60%] p-10 md:p-16 overflow-y-auto">
              <span className="text-[10px] font-bold text-brass uppercase tracking-[0.3em] mb-4 block">Executive Profile</span>
              <h3 className="font-display text-4xl md:text-5xl text-white tracking-tight font-medium mb-2">{selectedMember.name}</h3>
              <p className="text-lg text-white/60 font-body mb-10">{selectedMember.role}</p>

              <div className="space-y-6">
                {selectedMember.bio?.split('\n\n').map((para, i) => (
                  <p key={i} className="text-white/80 font-body leading-[1.8] text-base md:text-[17px]">
                    {para}
                  </p>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-white/5">
                <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Bestworth Products Limited • Leadership Board</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
