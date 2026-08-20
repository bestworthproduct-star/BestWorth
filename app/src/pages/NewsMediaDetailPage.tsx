import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Play } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { formatNewsDate } from '@/components/NewsMediaCard'
import NewsMediaPageHeader from '@/components/NewsMediaPageHeader'
import NewsMediaPageFooter from '@/components/NewsMediaPageFooter'
import NewsVideoPlayer from '@/components/NewsVideoPlayer'
import MediaVideoPreview from '@/components/MediaVideoPreview'
import type { NewsMediaPost } from '@/types/news-media'

export default function NewsMediaDetailPage() {
  const { slug } = useParams()
  const [post, setPost] = useState<NewsMediaPost | null>(null)
  const [related, setRelated] = useState<NewsMediaPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(apiUrl(`/api/news-media/${encodeURIComponent(slug || '')}`))
      .then(async (response) => {
        if (response.status === 404) { setNotFound(true); return null }
        if (!response.ok) throw new Error('Could not load update')
        return response.json()
      })
      .then((result) => { if (result) { setPost(result.post); setRelated(result.related || []); setNotFound(false) } })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!post) return
    const previousTitle = document.title
    document.title = post.seoTitle || `${post.title} | Bestworth`
    return () => { document.title = previousTitle }
  }, [post])

  return (
    <div className="min-h-screen bg-white text-[#102B4C]">
      <NewsMediaPageHeader />
      {loading ? (
        <main className="mx-auto flex min-h-[65vh] max-w-[900px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border border-[#102B4C]/12 border-t-[#102B4C]"/></main>
      ) : notFound || !post ? (
        <main className="mx-auto flex min-h-[65vh] max-w-[900px] items-center justify-center px-5 text-center"><div><p className="text-[18px] font-normal">This update is unavailable.</p><Link to="/news-media" className="mt-5 inline-flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.15em] text-[#060273]"><ArrowLeft size={13}/> Return to News &amp; Media</Link></div></main>
      ) : (
        <>
          <article>
            <header className="mx-auto max-w-[1060px] px-5 pb-10 pt-12 sm:px-8 lg:px-12 lg:pb-14 lg:pt-16">
              <Link to="/news-media" className="inline-flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.15em] text-[#102B4C]/42 transition hover:text-[#102B4C]"><ArrowLeft size={12}/> Newsroom</Link>
              <div className="mt-9 grid gap-7 border-b border-[#102B4C]/12 pb-10 md:grid-cols-[minmax(0,1fr)_190px] md:items-end lg:pb-12">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-medium uppercase tracking-[0.15em] text-[#102B4C]/38"><span className="text-[#D64545]">{post.type}</span><span>—</span><time>{formatNewsDate(post.publishedAt)}</time></div>
                  <h1 className="mt-4 max-w-[820px] text-[28px] font-normal leading-[1.2] tracking-[-0.02em] sm:text-[34px] lg:text-[40px]">{post.title}</h1>
                  <p className="mt-5 max-w-3xl text-[14px] font-normal leading-7 text-[#102B4C]/58">{post.excerpt}</p>
                </div>
                <div className="border-t border-[#102B4C]/10 pt-4 text-[9px] uppercase tracking-[0.14em] text-[#102B4C]/38 md:border-l md:border-t-0 md:pl-6 md:pt-0"><span className="block">Published by</span><span className="mt-2 block text-[11px] normal-case tracking-normal text-[#102B4C]/70">{post.author || 'Bestworth Media'}</span></div>
              </div>
            </header>

            <div className="mx-auto max-w-[1060px] px-5 sm:px-8 lg:px-12">
              {post.type === 'video' ? <NewsVideoPlayer src={post.videoUrl} poster={post.coverImage || undefined} title={post.title}/> : post.coverImage ? <figure><img src={resolveMediaUrl(post.coverImage)} alt="" className="max-h-[620px] w-full object-cover"/></figure> : null}
            </div>

            <div className="mx-auto max-w-[760px] px-5 pb-24 pt-12 sm:px-8 lg:pb-32 lg:pt-16">
              <div className="whitespace-pre-line text-[15px] font-normal leading-8 text-[#102B4C]/76">{post.body}</div>
              <div className="mt-14 border-t border-[#102B4C]/12 pt-5 text-[9px] uppercase tracking-[0.15em] text-[#102B4C]/38">Bestworth Products Limited · Company newsroom</div>
            </div>
          </article>

          {related.length > 0 && (
            <section className="border-t border-[#102B4C]/12 bg-[#F7F9FB] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
              <div className="mx-auto max-w-[1060px]">
                <div className="flex items-end justify-between border-b border-[#102B4C]/12 pb-5"><div><p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#D64545]">Continue reading</p><h2 className="mt-2 text-[22px] font-normal">More from the newsroom</h2></div><Link to="/news-media" className="hidden items-center gap-2 text-[9px] font-medium uppercase tracking-[0.14em] text-[#102B4C]/55 sm:inline-flex">All updates <ArrowUpRight size={12}/></Link></div>
                <div className="grid gap-0 md:grid-cols-3">
                  {related.map((item, index) => <article key={item._id} className={`border-b border-[#102B4C]/10 py-7 md:border-b-0 md:px-6 ${index === 0 ? 'md:pl-0' : 'md:border-l'} ${index === related.length - 1 ? 'md:pr-0' : ''}`}><Link to={`/news-media/${item.slug}`} className="group block"><div className="relative aspect-video overflow-hidden bg-[#102B4C]">{item.coverImage ? <img src={resolveMediaUrl(item.coverImage)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"/> : item.type === 'video' ? <MediaVideoPreview src={item.videoUrl} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-white/55"><Play size={18}/></div>}{item.type === 'video' && <span className="absolute bottom-3 left-3 flex h-7 w-7 items-center justify-center bg-white text-[#102B4C]"><Play size={10} fill="currentColor"/></span>}</div><div className="mt-4 text-[8px] font-medium uppercase tracking-[0.14em] text-[#102B4C]/38"><span className="text-[#D64545]">{item.type}</span><span className="mx-2">—</span>{formatNewsDate(item.publishedAt)}</div><h3 className="mt-2 text-[15px] font-normal leading-5 transition group-hover:text-[#060273]">{item.title}</h3></Link></article>)}
                </div>
              </div>
            </section>
          )}
        </>
      )}
      <NewsMediaPageFooter />
    </div>
  )
}
