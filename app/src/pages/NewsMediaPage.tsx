import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Play, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { formatNewsDate } from '@/components/NewsMediaCard'
import MediaVideoPreview from '@/components/MediaVideoPreview'
import NewsMediaPageHeader from '@/components/NewsMediaPageHeader'
import NewsMediaPageFooter from '@/components/NewsMediaPageFooter'
import type { NewsMediaResponse, NewsMediaType } from '@/types/news-media'

type Filter = 'all' | NewsMediaType

function getPageSize() {
  if (typeof window === 'undefined') return 8
  return window.innerWidth < 1024 ? 6 : 8
}

export default function NewsMediaPage() {
  const [result, setResult] = useState<NewsMediaResponse>({ items: [], pagination: { page: 1, limit: 8, total: 0, pages: 1 } })
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(getPageSize)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const resize = () => setPageSize(getPageSize())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
        if (filter !== 'all') params.set('type', filter)
        if (search.trim()) params.set('search', search.trim())
        const response = await fetch(apiUrl(`/api/news-media?${params}`), { signal: controller.signal })
        if (!response.ok) throw new Error('Could not load news and media')
        setResult(await response.json())
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResult({ items: [], pagination: { page: 1, limit: pageSize, total: 0, pages: 1 } })
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 250 : 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [filter, page, pageSize, search])

  useEffect(() => { setPage(1) }, [filter, search, pageSize])

  const changePage = (nextPage: number) => {
    setPage(nextPage)
    window.scrollTo({ top: 160, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white text-[#102B4C]">
      <NewsMediaPageHeader />
      <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-14 sm:px-8 lg:px-12 lg:pb-32 lg:pt-20">
        <header className="grid gap-7 border-b border-[#102B4C]/14 pb-10 md:grid-cols-[1fr_0.72fr] md:items-end lg:pb-12">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-[#D64545]">Company newsroom</p>
            <h1 className="mt-4 text-[32px] font-normal leading-tight tracking-[-0.02em] sm:text-[38px]">News &amp; Media</h1>
          </div>
          <p className="max-w-lg text-[13px] font-normal leading-6 text-[#102B4C]/58 md:justify-self-end">Official company announcements, industry perspectives and video briefings from Bestworth Products Limited.</p>
        </header>

        <div className="flex flex-col gap-5 border-b border-[#102B4C]/10 py-6 md:flex-row md:items-center md:justify-between">
          <nav className="flex items-center gap-7" aria-label="Filter newsroom">
            {(['all', 'news', 'video'] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`border-b pb-2 text-[10px] font-medium uppercase tracking-[0.14em] transition ${filter === item ? 'border-[#102B4C] text-[#102B4C]' : 'border-transparent text-[#102B4C]/38 hover:text-[#102B4C]'}`}>{item === 'all' ? 'All updates' : item}</button>)}
          </nav>
          <div className="relative w-full md:max-w-[320px]">
            <Search size={13} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#102B4C]/35"/>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the newsroom" className="w-full border-b border-[#102B4C]/18 bg-transparent py-2.5 pl-7 pr-8 text-[11px] font-normal outline-none placeholder:text-[#102B4C]/35 focus:border-[#102B4C]"/>
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 text-[#102B4C]/35 hover:text-[#102B4C]"><X size={13}/></button>}
          </div>
        </div>

        <div className="flex items-center justify-between py-5 text-[9px] uppercase tracking-[0.14em] text-[#102B4C]/38"><span>{result.pagination.total} {result.pagination.total === 1 ? 'record' : 'records'}</span><span>{String(result.pagination.page).padStart(2, '0')} / {String(result.pagination.pages).padStart(2, '0')}</span></div>

        {loading ? (
          <div className="border-t border-[#102B4C]/10">{Array.from({ length: Math.min(pageSize, 5) }, (_, index) => <div key={index} className="grid animate-pulse gap-6 border-b border-[#102B4C]/10 py-7 sm:grid-cols-[200px_1fr]"><div className="aspect-video bg-[#E8EDF2]"/><div className="space-y-4 py-2"><div className="h-2 w-28 bg-[#E8EDF2]"/><div className="h-5 w-3/4 bg-[#E8EDF2]"/><div className="h-3 w-full max-w-xl bg-[#E8EDF2]"/></div></div>)}</div>
        ) : result.items.length ? (
          <section className="border-t border-[#102B4C]/14" aria-label="Newsroom updates">
            {result.items.map((post) => (
              <article key={post._id} className="border-b border-[#102B4C]/12">
                <Link to={`/news-media/${post.slug}`} className="group grid gap-5 py-7 sm:grid-cols-[210px_minmax(0,1fr)_32px] sm:items-center lg:grid-cols-[250px_minmax(0,1fr)_40px] lg:gap-8 lg:py-8">
                  <div className="relative aspect-video overflow-hidden bg-[#E8EDF2]">
                    {post.coverImage ? <img src={resolveMediaUrl(post.coverImage)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"/> : post.type === 'video' ? <MediaVideoPreview src={post.videoUrl} className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center bg-[#102B4C] text-white/70"><Play size={20} strokeWidth={1.5}/></div>}
                    {post.type === 'video' && <span className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center bg-white text-[#102B4C]"><Play size={11} fill="currentColor"/></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-medium uppercase tracking-[0.15em] text-[#102B4C]/38"><span className="text-[#D64545]">{post.type}</span><span>—</span><time>{formatNewsDate(post.publishedAt)}</time><span>—</span><span>{post.author || 'Bestworth Media'}</span></div>
                    <h2 className="mt-3 text-[18px] font-normal leading-6 tracking-[-0.01em] text-[#102B4C] transition group-hover:text-[#060273] sm:text-[20px]">{post.title}</h2>
                    <p className="mt-2 line-clamp-2 max-w-2xl text-[12px] font-normal leading-5 text-[#102B4C]/52">{post.excerpt}</p>
                  </div>
                  <span className="hidden h-9 w-9 items-center justify-center border border-[#102B4C]/14 text-[#102B4C]/55 transition group-hover:border-[#102B4C] group-hover:bg-[#102B4C] group-hover:text-white sm:flex"><ArrowUpRight size={14}/></span>
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <div className="border-y border-[#102B4C]/12 py-20 text-center"><p className="text-[14px] font-normal">No updates match this view.</p><button type="button" onClick={() => { setSearch(''); setFilter('all') }} className="mt-4 text-[9px] font-medium uppercase tracking-[0.16em] text-[#060273]">Clear filters</button></div>
        )}

        {result.pagination.pages > 1 && <nav className="mt-12 flex items-center justify-between border-t border-[#102B4C]/12 pt-6" aria-label="Newsroom pages"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className="inline-flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.14em] text-[#102B4C] disabled:opacity-25"><ChevronLeft size={14}/> Previous</button><span className="text-[9px] tracking-[0.14em] text-[#102B4C]/42">Page {page} of {result.pagination.pages}</span><button type="button" disabled={page >= result.pagination.pages} onClick={() => changePage(page + 1)} className="inline-flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.14em] text-[#102B4C] disabled:opacity-25">Next <ChevronRight size={14}/></button></nav>}
      </main>
      <NewsMediaPageFooter />
    </div>
  )
}
