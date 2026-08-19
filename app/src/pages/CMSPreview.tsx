import { useState, useEffect } from 'react'
import HeroSection from '@/sections/HeroSection'
import AboutSection from '@/sections/AboutSection'
import ValuesSection from '@/sections/ValuesSection'
import ContactSection from '@/sections/ContactSection'
import Footer from '@/components/Footer'

export default function CMSPreview() {
  const [activeSection, setActiveSection] = useState('hero')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CMS_UPDATE') {
        setActiveSection(event.data.section)
        setData(event.data.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (!data) return null

  const renderContent = () => {
    switch (activeSection) {
      case 'hero':
        return <HeroSection scrollTo={() => {}} />
      case 'about':
        return <AboutSection />
      case 'values':
        return <ValuesSection />
      case 'contact':
        return <ContactSection />
      case 'footer':
        return <Footer scrollTo={() => {}} />
      case 'privacy_policy':
      case 'legal': // 'legal' maps to policies in the CMS tabs
        return (
          <div className="p-8 max-w-4xl mx-auto prose prose-sm">
            <h1 className="text-2xl font-bold mb-6">Privacy Policy Preview</h1>
            <div dangerouslySetInnerHTML={{ __html: data.privacy_policy?.html || '<i>No HTML content provided.</i>' }} />
            <div className="my-12 border-t border-charcoal/10" />
            <h1 className="text-2xl font-bold mb-6">Cookie Policy Preview</h1>
            <div dangerouslySetInnerHTML={{ __html: data.cookie_policy?.html || '<i>No HTML content provided.</i>' }} />
          </div>
        )
      default:
        return (
          <div className="p-20 text-center text-charcoal/20">
            <p className="text-sm font-bold uppercase tracking-widest">Section Context Not Defined for Preview</p>
          </div>
        )
    }
  }

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      {renderContent()}
    </div>
  )
}
