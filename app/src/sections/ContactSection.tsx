import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useSocket } from '../hooks/useSocket'

interface ContactData {
  address: string
  phone: string
  email: string
  mapUrl: string
}

export default function ContactSection() {
  const [contactData, setContactData] = useState<ContactData | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('http://localhost:5000/api/content/contact')
      .then(res => res.json())
      .then(data => setContactData(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'contact') setContactData(payload.data)
  })

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)

  useGSAP(() => {
    if (!sectionRef.current) return

    if (leftRef.current) {
      gsap.fromTo(
        leftRef.current,
        { opacity: 0, x: -40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      )
    }

    if (rightRef.current) {
      gsap.fromTo(
        rightRef.current,
        { opacity: 0, x: 40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          delay: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      )
    }
  }, { scope: sectionRef })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('http://localhost:5000/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          setFormData({ name: '', email: '', company: '', message: '' })
        }, 3000)
      } else {
        console.error('Failed to submit inquiry')
      }
    } catch (err) {
      console.error('Error submitting inquiry:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const inputClass =
    'w-full bg-transparent border-0 border-b-2 border-charcoal/15 py-4 px-0 font-body text-base text-charcoal placeholder:text-steel focus:outline-none focus:border-deep-teal transition-colors duration-300'

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="bg-warm-stone relative z-10 min-h-screen flex items-center py-16 md:py-[120px]"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Left Column - Form */}
          <div ref={leftRef} className="w-full lg:w-1/2">
            <span className="section-label section-label-light">
              GET IN TOUCH
            </span>
            <h2 className="font-display font-medium text-[28px] md:text-5xl text-charcoal leading-[1.1] tracking-[-0.02em] mt-4">
              Let's Build Something Together
            </h2>

            {submitted ? (
              <div className="mt-10 p-8 bg-deep-teal/10 border border-deep-teal/30">
                <p className="font-body text-lg text-deep-teal font-medium">
                  Thank you for your inquiry!
                </p>
                <p className="font-body text-base text-charcoal mt-2">
                  Our team will get back to you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Your Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
                <input
                  type="text"
                  name="company"
                  placeholder="Company Name"
                  value={formData.company}
                  onChange={handleChange}
                  className={inputClass}
                />
                <textarea
                  name="message"
                  placeholder="Your Message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  className={`${inputClass} resize-none min-h-[120px]`}
                />
                <button type="submit" className="btn-primary w-full mt-4">
                  SEND INQUIRY
                </button>
              </form>
            )}
          </div>

          {/* Right Column - Contact Info */}
          <div ref={rightRef} className="w-full lg:w-1/2 lg:pl-10">
            {contactData ? (
              <div className="space-y-10">
                {/* Address */}
                <div>
                  <span className="section-label section-label-dark" style={{ color: '#B8860B' }}>
                    HEAD OFFICE
                  </span>
                  <p className="font-body text-base md:text-[17px] text-charcoal leading-[1.7] mt-3">
                    {contactData.address}
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <span className="section-label section-label-dark" style={{ color: '#B8860B' }}>
                    CALL US
                  </span>
                  <p className="font-body text-base md:text-[17px] text-charcoal leading-[1.7] mt-3">
                    {contactData.phone}
                  </p>
                </div>

                {/* Email */}
                <div>
                  <span className="section-label section-label-dark" style={{ color: '#B8860B' }}>
                    EMAIL
                  </span>
                  <p className="font-body text-base md:text-[17px] text-charcoal leading-[1.7] mt-3">
                    {contactData.email}
                  </p>
                </div>

                {/* Map */}
                <div className="mt-10 relative aspect-[4/3] overflow-hidden">
                  <iframe
                    src={contactData.mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0, filter: 'grayscale(80%) contrast(1.1)' }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Bestworth Location"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundColor: 'rgba(242, 239, 233, 0.15)' }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-full">
                 <div className="w-8 h-8 border-2 border-charcoal/5 border-t-brass rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
