import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { useSocket } from '@/hooks/useSocket'
import { formatNewsDate } from '@/components/NewsMediaCard'
import HomepageVideoPlayer from '@/components/HomepageVideoPlayer'
import type { NewsMediaPost, NewsMediaResponse } from '@/types/news-media'

const formatNumber = (value: number) => String(value).padStart(2, '0')

export default function NewsMediaSection() {
  const [posts, setPosts] = useState<NewsMediaPost[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/news-media?limit=8'))
      if (!response.ok) throw new Error('Could not load updates')
      const result = await response.json() as NewsMediaResponse
      setPosts(result.items)
    } catch (loadError) {
      console.error(loadError)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPosts() }, [loadPosts])
  useSocket('news_media_change', loadPosts)

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(posts.length - 1, 0)))
  }, [posts.length])

  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(apiUrl('/api/newsletter/subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, policyAcknowledged, website: '' })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Subscription failed')
      setMessage(result.message)
      setEmail('')
      setPolicyAcknowledged(false)
    } catch (subscribeError) {
      setError(subscribeError instanceof Error ? subscribeError.message : 'Subscription failed')
    } finally {
      setSubmitting(false)
    }
  }

  const activePost = posts[activeIndex]
  const hasMultiplePosts = posts.length > 1
  const showPrevious = () => setActiveIndex((current) => (current - 1 + posts.length) % posts.length)
  const showNext = () => setActiveIndex((current) => (current + 1) % posts.length)

  return (
    <section id="news-media" className="relative z-10 overflow-hidden bg-[#F5F8FC] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,60fr)_minmax(0,35fr)] lg:gap-[5%]">
          <div className="flex flex-col border-t border-[#102B4C]/15 pt-7 lg:order-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#D64545]">Company updates</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#102B4C] sm:text-4xl lg:text-[42px]">News &amp; Media</h2>
              <p className="mt-4 max-w-sm text-[13px] leading-6 text-[#102B4C]/58">Company news, industry perspectives and video updates from Bestworth Products Limited.</p>
              <Link to="/news-media" className="mt-5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#060273] transition hover:text-[#D64545]">View all updates <ArrowRight size={14}/></Link>
            </div>

            <form onSubmit={subscribe} className="mt-12 border-t border-[#102B4C]/10 pt-7 lg:mt-auto">
              <div className="flex items-center gap-3">
                <Mail size={17} strokeWidth={1.7} className="text-[#102B4C]/65"/>
                <h3 className="text-[13px] font-semibold tracking-tight text-[#102B4C]">Subscribe to company updates</h3>
              </div>
              <p className="mt-3 max-w-sm text-[11px] leading-5 text-[#102B4C]/50">Occasional news and industry updates. No unnecessary messages.</p>
              <div className="mt-5 flex border border-[#102B4C]/15 bg-white focus-within:border-[#060273]/55">
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Business email address" aria-label="Business email address" className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[12px] text-[#102B4C] outline-none placeholder:text-[#102B4C]/35"/>
                <button disabled={submitting} className="border-l border-[#102B4C]/12 px-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#060273] transition hover:bg-[#102B4C] hover:text-white disabled:cursor-wait disabled:opacity-50">{submitting ? 'Please wait' : 'Subscribe'}</button>
              </div>
              <label className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-[#102B4C]/48">
                <input type="checkbox" required checked={policyAcknowledged} onChange={(event) => setPolicyAcknowledged(event.target.checked)} className="mt-0.5 accent-[#060273]"/>
                <span>I agree to the <Link to="/privacy-policy" className="text-[#102B4C] underline underline-offset-2">Privacy Policy</Link> and consent to receiving updates.</span>
              </label>
              {message && <p className="mt-4 flex items-center gap-2 text-[11px] text-emerald-700"><CheckCircle2 size={13}/>{message}</p>}
              {error && <p className="mt-4 text-[11px] text-[#B42318]">{error}</p>}
            </form>
          </div>

          <div className="relative w-full min-w-0 max-w-[680px] lg:order-1">
            {loading ? (
              <div className="aspect-video animate-pulse bg-[#E4EAF1]"/>
            ) : activePost ? (
              <div className="relative">
                {activePost.type === 'video' ? <HomepageVideoPlayer key={activePost._id} post={activePost}/> : <Link key={activePost._id} to={`/news-media/${activePost.slug}`} className="group relative block aspect-video overflow-hidden bg-[#102B4C]">
                  <img src={resolveMediaUrl(activePost.coverImage)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061A31]/95 via-[#061A31]/25 to-transparent"/>
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
                    <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F17B72]"><span>{activePost.type}</span><span className="h-1 w-1 rounded-full bg-white/35"/><time className="text-white/58">{formatNewsDate(activePost.publishedAt)}</time></div>
                    <h3 className="mt-2 max-w-2xl text-xl font-semibold leading-tight sm:text-[27px]">{activePost.title}</h3>
                    <p className="mt-2 max-w-xl line-clamp-2 text-[11px] leading-5 text-white/68 sm:text-[12px]">{activePost.excerpt}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em]">Open update <ArrowRight size={13}/></span>
                  </div>
                </Link>}

                {hasMultiplePosts && (
                  <>
                    <button type="button" onClick={showPrevious} aria-label="Previous update" className="absolute left-0 top-1/2 z-10 flex h-12 w-12 -translate-x-2 -translate-y-1/2 items-center justify-center border border-[#102B4C]/10 bg-white text-[#102B4C] shadow-[0_8px_30px_rgba(16,43,76,0.12)] transition hover:bg-[#102B4C] hover:text-white sm:-translate-x-1/2"><ChevronLeft size={19}/></button>
                    <button type="button" onClick={showNext} aria-label="Next update" className="absolute right-0 top-1/2 z-10 flex h-12 w-12 translate-x-2 -translate-y-1/2 items-center justify-center border border-[#102B4C]/10 bg-white text-[#102B4C] shadow-[0_8px_30px_rgba(16,43,76,0.12)] transition hover:bg-[#102B4C] hover:text-white sm:translate-x-1/2"><ChevronRight size={19}/></button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center border border-dashed border-[#102B4C]/15 bg-white p-8 text-center"><div><p className="text-[12px] font-semibold text-[#102B4C]">Updates are being prepared</p><p className="mt-2 text-[11px] text-[#102B4C]/45">News and video stories will appear here when published.</p></div></div>
            )}

            {posts.length > 0 && (
              <div className="mt-5 flex items-center justify-between border-b border-[#102B4C]/12 pb-4">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#102B4C]/42">Latest stories</span>
                <span className="text-[10px] font-semibold tracking-[0.16em] text-[#102B4C]/55">{formatNumber(activeIndex + 1)} / {formatNumber(posts.length)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
