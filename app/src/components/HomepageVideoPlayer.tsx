import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resolveMediaUrl } from '@/lib/media'
import type { NewsMediaPost } from '@/types/news-media'
import { formatNewsDate } from './NewsMediaCard'

type EmbedProvider = 'youtube' | 'vimeo'

function getEmbed(value: string): { provider: EmbedProvider; url: string } | null {
  try {
    const url = new URL(value)
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      const id = url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop()
      return id ? { provider: 'youtube', url: `https://www.youtube.com/embed/${id}?enablejsapi=1&controls=0&playsinline=1&rel=0&autoplay=0&mute=1` } : null
    }
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return id ? { provider: 'vimeo', url: `https://player.vimeo.com/video/${id}?autoplay=0&muted=1&controls=0` } : null
    }
  } catch { return null }
  return null
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function HomepageVideoPlayer({ post }: { post: NewsMediaPost }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [readyToPlay, setReadyToPlay] = useState(false)
  const [inView, setInView] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const embed = useMemo(() => getEmbed(post.videoUrl), [post.videoUrl])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.55), { threshold: [0, 0.55, 1] })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) {
      setReadyToPlay(false)
      setPlaying(false)
      videoRef.current?.pause()
      return
    }
    const timer = window.setTimeout(() => setReadyToPlay(true), 5000)
    return () => window.clearTimeout(timer)
  }, [inView])

  useEffect(() => {
    if (!readyToPlay || !inView || embed) return
    const video = videoRef.current
    if (!video) return
    video.muted = true
    setMuted(true)
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [embed, inView, readyToPlay])

  const sendEmbedCommand = (action: 'play' | 'pause' | 'mute' | 'unmute') => {
    const target = iframeRef.current?.contentWindow
    if (!target || !embed) return
    if (embed.provider === 'youtube') {
      const command = action === 'play' ? 'playVideo' : action === 'pause' ? 'pauseVideo' : action === 'mute' ? 'mute' : 'unMute'
      target.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*')
    } else {
      if (action === 'mute' || action === 'unmute') target.postMessage({ method: 'setVolume', value: action === 'mute' ? 0 : 1 }, '*')
      else target.postMessage({ method: action }, '*')
    }
  }

  useEffect(() => {
    if (!embed) return
    if (readyToPlay && inView) {
      sendEmbedCommand('play')
      setPlaying(true)
    } else {
      sendEmbedCommand('pause')
      setPlaying(false)
    }
  }, [embed, inView, readyToPlay])

  const togglePlayback = () => {
    setReadyToPlay(true)
    if (embed) {
      sendEmbedCommand(playing ? 'pause' : 'play')
      setPlaying((value) => !value)
      return
    }
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    if (embed) sendEmbedCommand(next ? 'mute' : 'unmute')
    else if (videoRef.current) videoRef.current.muted = next
  }

  const enterFullscreen = () => {
    const element = frameRef.current
    if (element?.requestFullscreen) void element.requestFullscreen()
  }

  return (
    <div ref={frameRef} className="group relative aspect-video overflow-hidden bg-[#07192C] text-white">
      {embed ? (
        <iframe ref={iframeRef} src={embed.url} title={post.title} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen onLoad={() => { if (readyToPlay && inView) sendEmbedCommand('play') }}/>
      ) : (
        <video ref={videoRef} playsInline preload="auto" poster={post.coverImage ? resolveMediaUrl(post.coverImage) : undefined} muted className="absolute inset-0 h-full w-full object-contain" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => { const video = event.currentTarget; setDuration(video.duration); if (!post.coverImage && video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.1, video.duration / 2) }} onEnded={() => setPlaying(false)}>
          <source src={resolveMediaUrl(post.videoUrl)}/>
        </video>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061A31]/90 via-transparent to-[#061A31]/35"/>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="text-[9px] uppercase tracking-[0.16em] text-white/65"><span className="text-[#F17B72]">Video</span><span className="mx-2">/</span>{formatNewsDate(post.publishedAt)}</div>
        <Link to={`/news-media/${post.slug}`} aria-label={`Open ${post.title}`} className="flex h-8 w-8 items-center justify-center border border-white/25 bg-black/15 transition hover:bg-white hover:text-[#102B4C]"><ArrowUpRight size={14}/></Link>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <Link to={`/news-media/${post.slug}`} className="mb-4 block max-w-xl text-[15px] font-medium leading-5 sm:text-[18px]">{post.title}</Link>
        {!embed && <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value) }} aria-label="Video progress" className="mb-3 h-1 w-full cursor-pointer accent-white"/>}
        <div className="flex items-center gap-3">
          <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'} className="flex h-9 w-9 items-center justify-center border border-white/30 bg-white text-[#102B4C] transition hover:bg-[#F17B72] hover:text-white">{playing ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}</button>
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute video' : 'Mute video'} className="flex h-9 w-9 items-center justify-center border border-white/25 bg-black/20 text-white transition hover:bg-white hover:text-[#102B4C]">{muted ? <VolumeX size={15}/> : <Volume2 size={15}/>}</button>
          {!embed && <span className="text-[9px] tabular-nums text-white/65">{formatTime(currentTime)} / {formatTime(duration)}</span>}
          {!readyToPlay && inView && <span className="text-[9px] text-white/50">Auto-play begins after 5 seconds</span>}
          <button type="button" onClick={enterFullscreen} aria-label="Enter fullscreen" className="ml-auto flex h-9 w-9 items-center justify-center text-white/75 transition hover:text-white"><Maximize size={15}/></button>
        </div>
      </div>
    </div>
  )
}
