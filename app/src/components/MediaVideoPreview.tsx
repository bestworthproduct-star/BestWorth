import { useMemo } from 'react'
import { resolveMediaUrl } from '@/lib/media'
import { isExternalMediaUrl, useCookieConsent } from '@/lib/cookie-consent'

function getPreviewEmbedUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube-nocookie.com/embed/${id}?controls=0&playsinline=1&rel=0&autoplay=0&mute=1` : ''
    }
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}?background=1&autoplay=0&muted=1` : ''
    }
  } catch { return '' }
  return ''
}

interface Props {
  src: string
  className?: string
  respectConsent?: boolean
}

export default function MediaVideoPreview({ src, className = '', respectConsent }: Props) {
  const embedUrl = useMemo(() => getPreviewEmbedUrl(src), [src])
  const consent = useCookieConsent()
  const shouldRespectConsent = respectConsent ?? !(typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))
  const requiresExternalConsent = Boolean(embedUrl || isExternalMediaUrl(resolveMediaUrl(src)))

  if (!src) return <div className={`bg-[#102B4C] ${className}`}/>
  if (requiresExternalConsent && shouldRespectConsent && !consent?.externalMedia) return <div aria-hidden="true" className={`flex items-center justify-center bg-[#102B4C] text-[8px] uppercase tracking-[0.12em] text-white/38 ${className}`}>External video</div>
  if (embedUrl) return <iframe src={embedUrl} title="Video preview" tabIndex={-1} aria-hidden="true" className={`pointer-events-none border-0 ${className}`} allow="encrypted-media"/>

  return <video src={resolveMediaUrl(src)} muted playsInline preload="auto" aria-hidden="true" className={className} onLoadedMetadata={(event) => { const video = event.currentTarget; if (video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.1, video.duration / 2) }}/>
}
