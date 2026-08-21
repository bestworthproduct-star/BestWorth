import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { saveCookieConsent, useCookieConsent } from '@/lib/cookie-consent'

interface Props {
  children: ReactNode
  title?: string
  className?: string
}

export default function ExternalMediaGate({ children, title = 'External media', className = '' }: Props) {
  const consent = useCookieConsent()
  if (consent?.externalMedia) return <>{children}</>

  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#EEF2F6] p-5 text-center text-[#102B4C] ${className}`}>
      <div className="max-w-[330px]">
        <ShieldCheck size={20} strokeWidth={1.5} className="mx-auto text-[#060273]"/>
        <p className="mt-3 text-[11px] font-medium">{title} is currently disabled</p>
        <p className="mt-1.5 text-[10px] leading-5 text-[#102B4C]/48">Enable external media to load content from a third-party provider.</p>
        <button type="button" onClick={() => saveCookieConsent({ externalMedia: true, analytics: false })} className="mt-4 border border-[#102B4C]/18 bg-white px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] transition hover:border-[#060273]/40">Enable external media</button>
      </div>
    </div>
  )
}
