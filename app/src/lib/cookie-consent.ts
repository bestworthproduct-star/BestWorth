import { useEffect, useState } from 'react'

export type CookieConsent = {
  version: number
  necessary: true
  externalMedia: boolean
  analytics: boolean
  decidedAt: string
}

export const COOKIE_CONSENT_VERSION = 1
export const COOKIE_CONSENT_NAME = 'bw_cookie_consent'
export const COOKIE_CONSENT_CHANGED = 'bestworth:cookie-consent-changed'
export const OPEN_COOKIE_PREFERENCES = 'bestworth:open-cookie-preferences'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function readCookieConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_NAME}=`))
    ?.slice(COOKIE_CONSENT_NAME.length + 1)

  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<CookieConsent>
    if (parsed.version !== COOKIE_CONSENT_VERSION || parsed.necessary !== true || typeof parsed.externalMedia !== 'boolean' || typeof parsed.analytics !== 'boolean' || typeof parsed.decidedAt !== 'string') return null
    return parsed as CookieConsent
  } catch {
    return null
  }
}

export function saveCookieConsent(preferences: Pick<CookieConsent, 'externalMedia' | 'analytics'>): CookieConsent {
  const consent: CookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    externalMedia: preferences.externalMedia,
    analytics: preferences.analytics,
    decidedAt: new Date().toISOString(),
  }
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent<CookieConsent>(COOKIE_CONSENT_CHANGED, { detail: consent }))
  return consent
}

export function openCookiePreferences() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES))
}

export function isExternalMediaUrl(value?: string | null) {
  if (!value || typeof window === 'undefined') return false
  try {
    return new URL(value, window.location.origin).origin !== window.location.origin
  } catch {
    return false
  }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readCookieConsent())

  useEffect(() => {
    const update = (event: Event) => {
      const customEvent = event as CustomEvent<CookieConsent>
      setConsent(customEvent.detail || readCookieConsent())
    }
    window.addEventListener(COOKIE_CONSENT_CHANGED, update)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED, update)
  }, [])

  return consent
}
