import { useState, useEffect } from 'react'
import HeroSection from '@/sections/HeroSection'
import AboutSection from '@/sections/AboutSection'
import ValuesSection from '@/sections/ValuesSection'
import ContactSection from '@/sections/ContactSection'

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

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      {activeSection === 'hero' && <HeroSection scrollTo={() => {}} />}
      {activeSection === 'about' && <AboutSection />}
      {activeSection === 'values' && <ValuesSection />}
      {activeSection === 'contact' && <ContactSection />}
    </div>
  )
}
