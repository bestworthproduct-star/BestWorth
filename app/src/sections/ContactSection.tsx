import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Clock, ArrowRight, X } from 'lucide-react'

interface ContactData {
  address: string
  phone: string
  email: string
  mapUrl: string
}

type InquiryType = 'Product Catalog' | 'Technical Specs' | 'Partnership' | 'Other'

export default function ContactSection() {
  const [contactData, setContactData] = useState<ContactData | null>(null)
  const [inquiryType, setInquiryType] = useState<InquiryType>('Product Catalog')
  const [showInfoModal, setShowInfoModal] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/content/contact'))
      .then(res => res.json())
      .then(data => setContactData(data))
      .catch(err => console.error(err))
  }, [])

  useSocket('content_change', (payload: any) => {
    if (payload.key === 'contact') setContactData(payload.data)
  })

  // Prevent background scroll when mobile modal is open
  useEffect(() => {
    if (showInfoModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showInfoModal])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false)

  useEffect(() => {
    const handleProductInquiry = (event: Event) => {
      const detail = (event as CustomEvent<{ productName?: string; categoryName?: string }>).detail
      if (!detail?.productName) return

      setSubmitted(false)
      setSubmitError('')
      setInquiryType('Technical Specs')
      setFormData((current) => ({
        ...current,
        message: `I would like to make an inquiry about ${detail.productName}${detail.categoryName ? ` (${detail.categoryName})` : ''}.`,
      }))
    }

    window.addEventListener('bestworth:product-inquiry', handleProductInquiry)
    return () => window.removeEventListener('bestworth:product-inquiry', handleProductInquiry)
  }, [])

  useGSAP(() => {
    if (!sectionRef.current) return

    const elements = sectionRef.current.querySelectorAll('.reveal-contact')
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
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      }
    )
  }, { scope: sectionRef })

  useGSAP(() => {
    if (showInfoModal && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { y: '100%' },
        { y: '0%', duration: 0.4, ease: 'power3.out' }
      )
    }
  }, { dependencies: [showInfoModal] })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(apiUrl('/api/inquiries'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, inquiryType, policyAcknowledged }),
      })
      const data = await response.json().catch(() => null)

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          setFormData({ name: '', email: '', company: '', message: '' })
          setPolicyAcknowledged(false)
        }, 3000)
      } else {
        setSubmitError(data?.message || 'Failed to submit inquiry')
      }
    } catch (err) {
      console.error('Error submitting inquiry:', err)
      setSubmitError('Error submitting inquiry')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const inputContainerClass = 'relative group w-full'
  const labelClass = 'absolute left-0 -top-3.5 text-charcoal/40 text-[11px] font-bold uppercase tracking-widest transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-steel peer-focus:-top-3.5 peer-focus:text-[11px] peer-focus:font-bold peer-focus:tracking-widest peer-focus:text-brass'
  const inputClass = 'peer w-full bg-transparent border-0 border-b border-charcoal/15 py-4 font-body text-base text-charcoal focus:outline-none focus:border-brass transition-colors placeholder-transparent'

  const inquiryTypes: InquiryType[] = ['Product Catalog', 'Technical Specs', 'Partnership', 'Other']

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="bg-white relative z-10 py-16 md:py-20 lg:py-24 overflow-hidden"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12 lg:gap-20">

          {/* Left Column - Partnership Form */}
          <div ref={leftRef} className="lg:col-span-7 reveal-contact">
            <div className="mb-8">
              <span className="section-label section-label-light text-[12px] font-bold text-brass tracking-widest">
                GET IN TOUCH
              </span>
              <h2 className="font-display font-bold text-[28px] md:text-[44px] text-charcoal leading-[1.1] tracking-tight mt-3">
                Initialize Your Partnership
              </h2>
              <p className="mt-4 text-charcoal/60 font-body text-[15px] md:text-[17px] leading-relaxed max-w-[600px]">
                Connect with our specialized teams to discuss catalog requirements, engineering specifications, or corporate collaborations.
              </p>
            </div>

            {submitted ? (
              <div className="p-10 bg-charcoal/[0.03] border border-charcoal/10 rounded-lg animate-in fade-in zoom-in duration-500">
                <div className="w-12 h-12 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mb-6">
                  <Send size={24} />
                </div>
                <h3 className="font-display font-bold text-2xl text-charcoal">Transmission Successful</h3>
                <p className="font-body text-base text-charcoal/70 mt-2">
                  Our systems have captured your inquiry. A representative will respond within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
                {submitError && (
                  <div className="border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 rounded-lg">
                    {submitError}
                  </div>
                )}

                {/* Inquiry Type Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-charcoal/40">Select Inquiry Path</label>
                  <div className="flex flex-wrap gap-2">
                    {inquiryTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setInquiryType(type)}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all border rounded-md ${
                          inquiryType === type
                            ? 'bg-charcoal border-charcoal text-white shadow-md'
                            : 'bg-white border-charcoal/10 text-charcoal/50 hover:border-charcoal/30'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className={inputContainerClass}>
                    <input type="text" name="name" id="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required className={inputClass} />
                    <label htmlFor="name" className={labelClass}>Full Name</label>
                  </div>
                  <div className={inputContainerClass}>
                    <input type="email" name="email" id="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required className={inputClass} />
                    <label htmlFor="email" className={labelClass}>Email Address</label>
                  </div>
                </div>

                <div className={inputContainerClass}>
                  <input type="text" name="company" id="company" placeholder="Company / Organization" value={formData.company} onChange={handleChange} className={inputClass} />
                  <label htmlFor="company" className={labelClass}>Company / Organization</label>
                </div>

                <div className={inputContainerClass}>
                  <textarea name="message" id="message" placeholder="Describe your requirement..." value={formData.message} onChange={handleChange} required rows={1} className={`${inputClass} resize-none min-h-[50px]`} />
                  <label htmlFor="message" className={labelClass}>Describe your requirement...</label>
                </div>

                <div className="space-y-6">
                  <label className="flex cursor-pointer items-start gap-4 p-5 bg-warm-stone/30 border border-charcoal/5 rounded-lg group hover:border-charcoal/15 transition-all">
                    <input
                      type="checkbox"
                      checked={policyAcknowledged}
                      onChange={(event) => setPolicyAcknowledged(event.target.checked)}
                      required
                      className="mt-1 h-4 w-4 shrink-0 accent-brass"
                    />
                    <span className="text-[13px] leading-relaxed text-charcoal/60">
                      I acknowledge the processing of my business data in accordance with the {' '}
                      <Link to="/privacy-policy" target="_blank" className="font-bold text-charcoal hover:text-brass underline underline-offset-4">Privacy Policy</Link>.
                    </span>
                  </label>

                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <button type="submit" disabled={submitting} className="btn-primary w-full md:w-auto min-w-[240px] flex items-center justify-center gap-3 py-4 shadow-lg shadow-charcoal/10">
                      {submitting ? 'TRANSMITTING...' : 'INITIALIZE INQUIRY'}
                      <ArrowRight size={18} />
                    </button>

                    {/* Mobile Only: Office Info Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowInfoModal(true)}
                      className="lg:hidden w-full md:w-auto flex items-center justify-center gap-2 border border-charcoal/10 py-4 px-6 rounded-lg text-[10px] font-bold uppercase tracking-widest text-charcoal hover:bg-charcoal/5 transition-all"
                    >
                      <MapPin size={16} className="text-brass" />
                      View Office Info & Location
                    </button>

                    <div className="flex items-center gap-2 text-charcoal/30">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Avg. Response: 24h</span>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Right Column - Desktop Only Presence & Info */}
          <div ref={rightRef} className="hidden lg:block lg:col-span-5 reveal-contact">
            {contactData ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-6">
                  <div className="p-6 bg-charcoal text-white rounded-xl shadow-xl shadow-charcoal/20">
                    <span className="text-[10px] font-bold text-brass uppercase tracking-[0.25em] mb-4 block">Corporate HQ</span>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <MapPin className="text-brass shrink-0 mt-1" size={18} />
                        <p className="font-body text-[15px] leading-relaxed text-white/80">{contactData.address}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Phone className="text-brass shrink-0" size={18} />
                        <p className="font-body text-[15px] text-white/80">{contactData.phone}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Mail className="text-brass shrink-0" size={18} />
                        <p className="font-body text-[15px] text-white/80">{contactData.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-charcoal/10 group shadow-lg">
                    <iframe
                      src={contactData.mapUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0, filter: 'grayscale(100%) contrast(1.2) brightness(0.95)' }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Bestworth Location"
                    />
                    <div className="absolute inset-0 pointer-events-none border-[8px] border-white/10" />
                    <button
                      onClick={() => window.open(contactData.mapUrl, '_blank')}
                      className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-charcoal px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-white transition-colors"
                    >
                      Maximize Map
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-full py-20">
                 <div className="w-10 h-10 border-2 border-charcoal/5 border-t-brass rounded-full animate-spin"></div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Info Modal (Bottom Sheet) */}
      {showInfoModal && (
        <div className="lg:hidden fixed inset-0 z-[10000] flex items-end justify-center p-0">
          <div
            className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm"
            onClick={() => setShowInfoModal(false)}
          />
          <div
            ref={modalRef}
            className="relative w-full max-h-[90vh] bg-white rounded-t-3xl overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.3)] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-charcoal/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brass/10 flex items-center justify-center text-brass">
                  <MapPin size={18} />
                </div>
                <h3 className="font-display font-bold text-xl text-charcoal">Corporate Presence</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-10 h-10 rounded-full bg-warm-stone flex items-center justify-center text-charcoal/40 hover:text-charcoal transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {contactData ? (
                <>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-warm-stone/30">
                      <MapPin className="text-brass shrink-0 mt-1" size={18} />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-1">Address</p>
                        <p className="font-body text-[15px] leading-relaxed text-charcoal/80">{contactData.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-warm-stone/30">
                      <Phone className="text-brass shrink-0" size={18} />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-1">Phone</p>
                        <p className="font-body text-[15px] text-charcoal/80">{contactData.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-warm-stone/30">
                      <Mail className="text-brass shrink-0" size={18} />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-1">Email</p>
                        <p className="font-body text-[15px] text-charcoal/80">{contactData.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-charcoal/10 shadow-inner">
                    <iframe
                      src={contactData.mapUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0, filter: 'grayscale(100%) contrast(1.2) brightness(0.95)' }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Bestworth Location"
                    />
                    <button
                      onClick={() => window.open(contactData.mapUrl, '_blank')}
                      className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-charcoal px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-md"
                    >
                      Open in Maps
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-2 border-charcoal/5 border-t-brass rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <div className="p-6 pt-2 pb-10">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full btn-primary py-4"
              >
                RETURN TO FORM
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
