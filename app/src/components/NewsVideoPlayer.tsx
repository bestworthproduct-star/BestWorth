import { useMemo, useRef, useState } from 'react'
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

type EmbedProvider = 'youtube' | 'vimeo'

function getEmbed(value: string): { provider: EmbedProvider; url: string } | null {
  try {
    const url = new URL(value)
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop()
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
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

interface Props {
  src: string
  poster?: string
  title: string
}

export default function NewsVideoPlayer({ src, poster, title }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const embed = useMemo(() => getEmbed(src), [src])
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const sendEmbedCommand = (action: 'play' | 'pause' | 'mute' | 'unmute') => {
    const target = iframeRef.current?.contentWindow
    if (!target || !embed) return
    if (embed.provider === 'youtube') {
      const command = action === 'play' ? 'playVideo' : action === 'pause' ? 'pauseVideo' : action === 'mute' ? 'mute' : 'unMute'
      target.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*')
    } else if (action === 'mute' || action === 'unmute') {
      target.postMessage({ method: 'setVolume', value: action === 'mute' ? 0 : 1 }, '*')
    } else {
      target.postMessage({ method: action }, '*')
    }
  }

  const togglePlayback = () => {
    if (embed) {
      if (!started) {
        setStarted(true)
        setPlaying(true)
        window.setTimeout(() => sendEmbedCommand('play'), 0)
        return
      }
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

  return (
    <div ref={frameRef} className="group relative aspect-video overflow-hidden bg-[#07192C] text-white">
      {embed ? <iframe ref={iframeRef} src={embed.url} title={title} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen onLoad={() => { if (playing) sendEmbedCommand('play') }}/> : <video ref={videoRef} playsInline preload="auto" muted poster={poster ? resolveMediaUrl(poster) : undefined} className="absolute inset-0 h-full w-full object-contain" onPlay={() => { setStarted(true); setPlaying(true) }} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => { const video = event.currentTarget; setDuration(video.duration); if (!poster && video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.1, video.duration / 2) }} onEnded={() => setPlaying(false)}><source src={resolveMediaUrl(src)}/></video>}
      <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'} className={`absolute inset-0 flex items-center justify-center transition ${playing ? 'pointer-events-none opacity-0 group-hover:opacity-100' : ''}`}><span className="flex h-14 w-14 items-center justify-center border border-white/25 bg-white text-[#102B4C] shadow-lg">{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</span></button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-14 sm:px-5">
        {!embed && <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value) }} aria-label="Video progress" className="mb-3 h-1 w-full cursor-pointer accent-white"/>}
        <div className="flex items-center gap-2">
          <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'} className="flex h-9 w-9 items-center justify-center border border-white/25 bg-white text-[#102B4C]">{playing ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}</button>
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute video' : 'Mute video'} className="flex h-9 w-9 items-center justify-center text-white/75 hover:text-white">{muted ? <VolumeX size={15}/> : <Volume2 size={15}/>}</button>
          {!embed && <span className="text-[9px] tabular-nums text-white/60">{formatTime(currentTime)} / {formatTime(duration)}</span>}
          <button type="button" onClick={() => frameRef.current?.requestFullscreen && void frameRef.current.requestFullscreen()} aria-label="Enter fullscreen" className="ml-auto flex h-9 w-9 items-center justify-center text-white/75 hover:text-white"><Maximize size={15}/></button>
        </div>
      </div>
    </div>
  )
}
