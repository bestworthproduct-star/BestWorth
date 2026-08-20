import { useMemo } from 'react'
import { resolveMediaUrl } from '@/lib/media'

function getPreviewEmbedUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube.com/embed/${id}?controls=0&playsinline=1&rel=0&autoplay=0&mute=1` : ''
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
}

export default function MediaVideoPreview({ src, className = '' }: Props) {
  const embedUrl = useMemo(() => getPreviewEmbedUrl(src), [src])

  if (!src) return <div className={`bg-[#102B4C] ${className}`}/>
  if (embedUrl) return <iframe src={embedUrl} title="Video preview" tabIndex={-1} aria-hidden="true" className={`pointer-events-none border-0 ${className}`} allow="encrypted-media"/>

  return <video src={resolveMediaUrl(src)} muted playsInline preload="auto" aria-hidden="true" className={className} onLoadedMetadata={(event) => { const video = event.currentTarget; if (video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.1, video.duration / 2) }}/>
}
