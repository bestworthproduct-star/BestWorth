import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Settings2, ShieldCheck, X } from 'lucide-react'
import {
  COOKIE_CONSENT_CHANGED,
  OPEN_COOKIE_PREFERENCES,
  readCookieConsent,
  saveCookieConsent,
  type CookieConsent,
} from '@/lib/cookie-consent'

export default function CookieConsentBanner({ hidden = false }: { hidden?: boolean }) {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readCookieConsent())
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [externalMedia, setExternalMedia] = useState(consent?.externalMedia ?? false)

  useEffect(() => {
    const openPreferences = () => {
      const current = readCookieConsent()
      setConsent(current)
      setExternalMedia(current?.externalMedia ?? false)
      setPreferencesOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_PREFERENCES, openPreferences)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES, openPreferences)
  }, [])

  useEffect(() => {
    const syncConsent = (event: Event) => setConsent((event as CustomEvent<CookieConsent>).detail || readCookieConsent())
    window.addEventListener(COOKIE_CONSENT_CHANGED, syncConsent)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED, syncConsent)
  }, [])

  useEffect(() => {
    if (!preferencesOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreferencesOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [preferencesOpen])

  if (hidden) return null

  const persist = (nextExternalMedia: boolean) => {
    const saved = saveCookieConsent({ externalMedia: nextExternalMedia, analytics: false })
    setConsent(saved)
    setExternalMedia(saved.externalMedia)
    setPreferencesOpen(false)
  }

  return (
    <>
      {!consent && !preferencesOpen && (
        <section aria-label="Cookie consent" className="fixed inset-x-3 bottom-3 z-[12000] mx-auto max-w-[920px] border border-white/10 bg-[#102B4C] text-white shadow-[0_18px_55px_rgba(5,20,38,0.32)] sm:inset-x-5 sm:bottom-5">
          <div className="h-[3px] bg-[#D64545]" />
          <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[570px]">
              <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.18em] text-white/45"><ShieldCheck size={13} /> Privacy choices</div>
              <p className="mt-2 text-[13px] font-normal leading-6 text-white/72">We use necessary storage for site security and your preferences. External media such as Google Maps, YouTube and Vimeo load only with your permission.</p>
              <p className="mt-2 text-[10px] text-white/38"><Link to="/cookie-policy" className="underline underline-offset-2 hover:text-white">Cookie Policy</Link><span className="mx-2">·</span><Link to="/privacy-policy" className="underline underline-offset-2 hover:text-white">Privacy Policy</Link></p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={() => persist(false)} className="min-h-10 border border-white/18 px-4 text-[9px] font-medium uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">Necessary only</button>
              <button type="button" onClick={() => setPreferencesOpen(true)} className="min-h-10 border border-white/18 px-4 text-[9px] font-medium uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white"><span className="inline-flex items-center gap-1.5"><Settings2 size={12}/> Manage</span></button>
              <button type="button" onClick={() => persist(true)} className="col-span-2 min-h-10 bg-white px-5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#102B4C] transition hover:bg-[#F1F4F8]">Allow external media</button>
            </div>
          </div>
        </section>
      )}

      {preferencesOpen && (
        <div className="fixed inset-0 z-[12010] flex items-end justify-center bg-[#07192C]/42 p-3 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreferencesOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="cookie-preferences-title" className="w-full max-w-[620px] border border-[#102B4C]/12 bg-white text-[#102B4C] shadow-[0_24px_80px_rgba(5,20,38,0.26)]">
            <header className="flex items-start justify-between border-b border-[#102B4C]/10 px-5 py-5 sm:px-7">
              <div><p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#D64545]">Privacy controls</p><h2 id="cookie-preferences-title" className="mt-1.5 text-[19px] font-medium tracking-[-0.01em]">Cookie preferences</h2></div>
              <button type="button" onClick={() => setPreferencesOpen(false)} aria-label="Close cookie preferences" className="flex h-9 w-9 items-center justify-center text-[#102B4C]/42 transition hover:bg-[#F1F4F8] hover:text-[#102B4C]"><X size={16}/></button>
            </header>
            <div className="space-y-0 px-5 sm:px-7">
              <div className="flex items-start justify-between gap-5 border-b border-[#102B4C]/10 py-5">
                <div><h3 className="text-[12px] font-medium">Necessary</h3><p className="mt-1.5 max-w-[430px] text-[11px] leading-5 text-[#102B4C]/52">Required for security, administrator sessions and remembering this choice.</p></div>
                <span className="mt-0.5 inline-flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-700"><Check size={12}/> Always active</span>
              </div>
              <div className="flex items-start justify-between gap-5 py-5">
                <div><h3 className="text-[12px] font-medium">External media</h3><p className="mt-1.5 max-w-[430px] text-[11px] leading-5 text-[#102B4C]/52">Allows Google Maps, YouTube and Vimeo content. These providers may store or access information on your device.</p></div>
                <div className="mt-0.5 flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`text-[8px] font-semibold uppercase tracking-[0.12em] ${externalMedia ? 'text-[#060273]' : 'text-[#102B4C]/42'}`}>{externalMedia ? 'Enabled' : 'Disabled'}</span>
                  <button type="button" role="switch" aria-label={`External media ${externalMedia ? 'enabled' : 'disabled'}`} aria-checked={externalMedia} onClick={() => setExternalMedia((value) => !value)} className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${externalMedia ? 'border-[#060273] bg-[#060273]' : 'border-[#102B4C]/18 bg-[#E5EAF0]'}`}>
                    <span className={`absolute top-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${externalMedia ? 'translate-x-[23px] text-[#060273]' : 'translate-x-[3px] text-[#102B4C]/45'}`}>{externalMedia ? <Check size={11} strokeWidth={2.5}/> : <X size={10} strokeWidth={2.2}/>}</span>
                  </button>
                </div>
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-[#102B4C]/10 bg-[#F7F9FB] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" onClick={() => persist(false)} className="min-h-10 border border-[#102B4C]/15 bg-white px-4 text-[9px] font-medium uppercase tracking-[0.12em]">Reject optional</button>
              <button type="button" onClick={() => persist(externalMedia)} className="min-h-10 bg-[#060273] px-5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white">Save preferences</button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
