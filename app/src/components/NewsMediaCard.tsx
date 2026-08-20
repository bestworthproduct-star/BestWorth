import { ArrowUpRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resolveMediaUrl } from '@/lib/media'
import type { NewsMediaPost } from '@/types/news-media'
import MediaVideoPreview from './MediaVideoPreview'

interface Props {
  post: NewsMediaPost
  compact?: boolean
}

export function formatNewsDate(value?: string | null) {
  if (!value) return 'Date pending'
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default function NewsMediaCard({ post, compact = false }: Props) {
  if (compact) {
    return (
      <Link to={`/news-media/${post.slug}`} className="group grid grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg border border-[#102B4C]/10 bg-white transition hover:border-[#060273]/25 hover:shadow-[0_14px_34px_rgba(16,43,76,0.08)] sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="relative min-h-[122px] overflow-hidden bg-[#EAF0F7]">
          {post.coverImage ? <img src={resolveMediaUrl(post.coverImage)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : post.type === 'video' ? <MediaVideoPreview src={post.videoUrl} className="h-full w-full object-cover"/> : <div className="h-full w-full bg-[#102B4C]"/>}
          {post.type === 'video' && <span className="absolute inset-0 flex items-center justify-center bg-[#060273]/15"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#060273] shadow"><Play size={14} fill="currentColor" /></span></span>}
        </div>
        <div className="flex min-w-0 flex-col justify-between p-4">
          <div><div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#D64545]"><span>{post.type}</span><span className="h-1 w-1 rounded-full bg-[#102B4C]/20"/><time className="text-[#102B4C]/38">{formatNewsDate(post.publishedAt)}</time></div><h3 className="mt-2 line-clamp-2 text-[14px] font-semibold leading-5 text-[#102B4C]">{post.title}</h3></div>
          <span className="mt-3 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#060273]">Open <ArrowUpRight size={11}/></span>
        </div>
      </Link>
    )
  }

  return (
    <Link to={`/news-media/${post.slug}`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-[#102B4C]/10 bg-white transition hover:-translate-y-0.5 hover:border-[#060273]/25 hover:shadow-[0_18px_46px_rgba(16,43,76,0.09)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#EAF0F7]">
        {post.coverImage ? <img src={resolveMediaUrl(post.coverImage)} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" /> : post.type === 'video' ? <MediaVideoPreview src={post.videoUrl} className="h-full w-full object-cover"/> : <div className="h-full w-full bg-[#102B4C]"/>}
        {post.type === 'video' && <span className="absolute inset-0 flex items-center justify-center bg-[#060273]/15"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#060273] shadow-lg"><Play size={17} fill="currentColor" /></span></span>}
        {post.videoDuration && <span className="absolute bottom-3 right-3 rounded bg-[#102B4C]/85 px-2 py-1 text-[9px] font-medium text-white">{post.videoDuration}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#D64545]"><span>{post.type}</span><span className="h-1 w-1 rounded-full bg-[#102B4C]/20"/><time className="text-[#102B4C]/38">{formatNewsDate(post.publishedAt)}</time></div>
        <h3 className="mt-3 line-clamp-2 text-[17px] font-semibold leading-6 text-[#102B4C]">{post.title}</h3>
        <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-[#102B4C]/52">{post.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#060273]">Read update <ArrowUpRight size={11}/></span>
      </div>
    </Link>
  )
}
