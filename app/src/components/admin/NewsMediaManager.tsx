import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Edit3, ExternalLink, FileText, Image, Mail, Play, Plus, Search, Star, Trash2, UploadCloud, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { useSocket } from '@/hooks/useSocket'
import type { NewsMediaPost, NewsMediaResponse, NewsMediaStatus, NewsMediaType } from '@/types/news-media'
import MediaVideoPreview from '@/components/MediaVideoPreview'

type Filter = 'all' | NewsMediaType | NewsMediaStatus
type PostForm = Omit<NewsMediaPost, '_id' | 'createdAt' | 'updatedAt'>

const blankForm: PostForm = {
  title: '', slug: '', type: 'news', excerpt: '', body: '', coverImage: '', videoUrl: '', videoDuration: '',
  featured: false, status: 'draft', publishedAt: null, author: 'Bestworth Media', seoTitle: '', seoDescription: ''
}

interface Subscriber { _id: string; email: string; consentAt: string; createdAt: string }
interface Props { canManage: boolean; isAdmin: boolean }

function dateInputValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function NewsMediaManager({ canManage, isAdmin }: Props) {
  const [result, setResult] = useState<NewsMediaResponse>({ items: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } })
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PostForm>({ ...blankForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null)
  const [showSubscribers, setShowSubscribers] = useState(false)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [subscriberTotal, setSubscriberTotal] = useState(0)
  const token = localStorage.getItem('adminToken')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter === 'news' || filter === 'video') params.set('type', filter)
      if (filter === 'draft' || filter === 'published') params.set('status', filter)
      if (search.trim()) params.set('search', search.trim())
      const response = await fetch(apiUrl(`/api/news-media/admin/list?${params}`), { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not load posts')
      setResult(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load posts')
    } finally { setLoading(false) }
  }, [filter, page, search, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [loadPosts, search])
  useSocket('news_media_change', loadPosts)
  useEffect(() => { setPage(1) }, [filter, search])

  const loadSubscribers = useCallback(async () => {
    if (!isAdmin) return
    try {
      const response = await fetch(apiUrl('/api/newsletter/admin/subscribers'), { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (response.ok) { setSubscribers(data.subscribers || []); setSubscriberTotal(data.total || 0) }
    } catch { /* subscriber summary is non-blocking */ }
  }, [isAdmin, token])
  useEffect(() => { void loadSubscribers() }, [loadSubscribers])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...blankForm })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (post: NewsMediaPost) => {
    setEditId(post._id)
    setForm({
      title: post.title, slug: post.slug, type: post.type, excerpt: post.excerpt, body: post.body,
      coverImage: post.coverImage, videoUrl: post.videoUrl || '', videoDuration: post.videoDuration || '',
      featured: post.featured, status: post.status, publishedAt: post.publishedAt, author: post.author || 'Bestworth Media',
      seoTitle: post.seoTitle || '', seoDescription: post.seoDescription || ''
    })
    setError('')
    setModalOpen(true)
  }

  const uploadCover = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('Cover image must be 10MB or less.'); return }
    setUploadProgress(0)
    setError('')
    const data = new FormData()
    data.append('file', file)
    data.append('scope', 'media')
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', apiUrl('/api/upload'))
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100)) }
      xhr.onload = () => {
        const response = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300) setForm((current) => ({ ...current, coverImage: response.url }))
        else setError(response.message || 'Cover upload failed')
        resolve()
      }
      xhr.onerror = () => { setError('Cover upload failed'); resolve() }
      xhr.send(data)
    })
    setUploadProgress(null)
  }

  const uploadVideo = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { setError('Video file must be 50MB or less.'); return }
    setVideoUploadProgress(0)
    setError('')
    const data = new FormData()
    data.append('file', file)
    data.append('scope', 'media')
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', apiUrl('/api/upload'))
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setVideoUploadProgress(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onload = () => {
        let response: { url?: string; message?: string } = {}
        try { response = JSON.parse(xhr.responseText || '{}') } catch { /* handled below */ }
        if (xhr.status >= 200 && xhr.status < 300 && response.url) {
          setForm((current) => ({ ...current, videoUrl: response.url || '' }))
        } else {
          setError(response.message || 'Video upload failed')
        }
        resolve()
      }
      xhr.onerror = () => { setError('Video upload failed'); resolve() }
      xhr.send(data)
    })
    setVideoUploadProgress(null)
  }

  const savePost = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(apiUrl(editId ? `/api/news-media/admin/${editId}` : '/api/news-media/admin'), {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not save post')
      setModalOpen(false)
      await loadPosts()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save post')
    } finally { setSaving(false) }
  }

  const deletePost = async (post: NewsMediaPost) => {
    if (!window.confirm(`Permanently delete “${post.title}”?`)) return
    const response = await fetch(apiUrl(`/api/news-media/admin/${post._id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok) { setError(data.message || 'Could not delete post'); return }
    await loadPosts()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#102B4C]/10 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex items-center gap-2"><FileText size={16} className="text-[#060273]"/><h2 className="text-[13px] font-semibold text-[#102B4C]">Publishing workspace</h2></div><p className="mt-1 text-[11px] text-[#102B4C]/45">Create controlled company news and video updates for the public site.</p></div>
          <div className="flex flex-wrap gap-2">{isAdmin && <button onClick={() => setShowSubscribers((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-[#102B4C]/10 px-4 py-2.5 text-[10px] font-semibold text-[#102B4C]"><Mail size={13}/> Subscribers · {subscriberTotal}</button>}{canManage && <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-[#102B4C] px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#060273]"><Plus size={13}/> New content</button>}</div>
        </div>
      </div>

      {error && !modalOpen && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</div>}
      {showSubscribers && isAdmin && <div className="rounded-lg border border-[#102B4C]/10 bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="text-[12px] font-semibold text-[#102B4C]">Newsletter subscribers</h3><p className="mt-1 text-[10px] text-[#102B4C]/40">Owner-only contact data · {subscriberTotal} active</p></div><button onClick={() => setShowSubscribers(false)} className="p-2 text-[#102B4C]/35"><X size={15}/></button></div><div className={`mt-4 divide-y divide-[#102B4C]/7 rounded-lg border border-[#102B4C]/8 ${subscribers.length > 6 ? 'max-h-[330px] overflow-y-auto [scrollbar-width:thin]' : ''}`}>{subscribers.length ? subscribers.map((subscriber) => <div key={subscriber._id} className="flex items-center justify-between gap-4 px-4 py-3"><span className="truncate text-[11px] text-[#102B4C]/70">{subscriber.email}</span><time className="shrink-0 text-[9px] text-[#102B4C]/35">{new Date(subscriber.consentAt).toLocaleDateString()}</time></div>) : <p className="p-8 text-center text-[11px] text-[#102B4C]/40">No active subscribers yet.</p>}</div></div>}

      <div className="flex flex-col gap-3 rounded-lg border border-[#102B4C]/10 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#102B4C]/30"/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, excerpt or author…" className="w-full rounded-md border border-[#102B4C]/10 bg-[#F7F9FC] py-2.5 pl-9 pr-3 text-[11px] outline-none focus:border-[#060273]/30"/></div>
        <div className="flex max-w-full overflow-x-auto rounded-md bg-[#F5F8FC] p-1">{(['all', 'news', 'video', 'draft', 'published'] as Filter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded px-4 py-2 text-[9px] font-semibold capitalize ${filter === item ? 'bg-white text-[#060273] shadow-sm' : 'text-[#102B4C]/40'}`}>{item}</button>)}</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#102B4C]/10 bg-white">
        <div className="hidden grid-cols-[1.7fr_0.55fr_0.65fr_0.7fr_90px] border-b border-[#102B4C]/8 bg-[#F7F9FC] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#102B4C]/35 md:grid"><span>Content</span><span>Type</span><span>Status</span><span>Published</span><span className="text-right">Actions</span></div>
        {loading ? <div className="p-12 text-center text-[10px] text-[#102B4C]/40">Loading publishing workspace…</div> : result.items.length === 0 ? <div className="p-14 text-center"><FileText className="mx-auto text-[#102B4C]/15"/><p className="mt-3 text-[11px] text-[#102B4C]/40">No content matches this view.</p></div> : <div className="divide-y divide-[#102B4C]/7">{result.items.map((post) => <div key={post._id} className="grid gap-3 p-4 md:grid-cols-[1.7fr_0.55fr_0.65fr_0.7fr_90px] md:items-center md:px-5"><div className="flex min-w-0 items-center gap-3"><div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-[#EAF0F7]">{post.coverImage ? <img src={resolveMediaUrl(post.coverImage)} alt="" className="h-full w-full object-cover"/> : post.type === 'video' ? <MediaVideoPreview src={post.videoUrl} className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center bg-[#102B4C] text-white/55"><Play size={13}/></div>}{post.type === 'video' && <Play size={11} fill="currentColor" className="absolute bottom-1 right-1 text-white drop-shadow"/>}</div><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[12px] font-semibold text-[#102B4C]">{post.title}</p>{post.featured && <Star size={11} fill="currentColor" className="shrink-0 text-[#D64545]"/>}</div><p className="mt-1 truncate text-[9px] text-[#102B4C]/35">/{post.slug}</p></div></div><span className="w-fit rounded bg-[#F5F8FC] px-2 py-1 text-[9px] font-semibold capitalize text-[#102B4C]/55">{post.type}</span><span className={`w-fit rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${post.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{post.status}</span><time className="text-[10px] text-[#102B4C]/40">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Not set'}</time><div className="flex justify-end gap-1">{post.status === 'published' && <a href={`/news-media/${post.slug}`} target="_blank" rel="noreferrer" className="p-2 text-[#102B4C]/35 hover:text-[#060273]"><ExternalLink size={13}/></a>}{canManage && <><button onClick={() => openEdit(post)} className="p-2 text-[#102B4C]/35 hover:text-[#060273]"><Edit3 size={13}/></button><button onClick={() => void deletePost(post)} className="p-2 text-[#102B4C]/35 hover:text-red-700"><Trash2 size={13}/></button></>}</div></div>)}</div>}
      </div>

      {result.pagination.pages > 1 && <div className="flex items-center justify-center gap-3"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-[#102B4C]/10 bg-white p-2 disabled:opacity-30"><ArrowLeft size={13}/></button><span className="text-[9px] font-semibold tracking-[0.14em] text-[#102B4C]/40">{page} / {result.pagination.pages}</span><button disabled={page >= result.pagination.pages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-[#102B4C]/10 bg-white p-2 disabled:opacity-30"><ArrowRight size={13}/></button></div>}

      {modalOpen && <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5"><div className="absolute inset-0 bg-[#102B4C]/55 backdrop-blur-sm" onClick={() => !saving && setModalOpen(false)}/><section className="relative max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl [scrollbar-width:thin]"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#102B4C]/8 bg-white px-5 py-4 sm:px-7"><div><h2 className="text-lg font-semibold text-[#102B4C]">{editId ? 'Edit content' : 'Create content'}</h2><p className="mt-0.5 text-[10px] text-[#102B4C]/40">Draft safely, preview the cover and publish when ready.</p></div><button onClick={() => setModalOpen(false)} disabled={saving} className="p-2 text-[#102B4C]/35"><X size={17}/></button></div><form onSubmit={savePost} className="space-y-6 p-5 sm:p-7">{error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</div>}<div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="space-y-5"><Field label="Title"><input required maxLength={180} value={form.title} onChange={(event) => setForm({...form,title:event.target.value})} className={inputClass}/></Field><Field label="Slug (optional)"><input value={form.slug} onChange={(event) => setForm({...form,slug:event.target.value})} placeholder="Generated from title" className={inputClass}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Content type"><select value={form.type} onChange={(event) => setForm({...form,type:event.target.value as NewsMediaType})} className={inputClass}><option value="news">News</option><option value="video">Video</option></select></Field><Field label="Author"><input value={form.author} onChange={(event) => setForm({...form,author:event.target.value})} className={inputClass}/></Field></div><Field label="Short excerpt"><textarea required maxLength={500} rows={3} value={form.excerpt} onChange={(event) => setForm({...form,excerpt:event.target.value})} className={`${inputClass} resize-none`}/><p className="mt-1 text-right text-[9px] text-[#102B4C]/30">{form.excerpt.length}/500</p></Field><Field label={form.type === 'video' ? 'Video description' : 'Article body'}><textarea required rows={12} value={form.body} onChange={(event) => setForm({...form,body:event.target.value})} className={`${inputClass} resize-y leading-6`}/></Field></div><div className="space-y-5"><Field label={form.type === 'video' ? 'Cover image (optional)' : 'Cover image'}><div className="overflow-hidden rounded-lg border border-[#102B4C]/10 bg-[#F5F8FC]"><div className="aspect-[16/10] bg-[#EAF0F7]">{form.coverImage ? <img src={resolveMediaUrl(form.coverImage)} alt="Cover preview" className="h-full w-full object-cover"/> : form.type === 'video' && form.videoUrl ? <MediaVideoPreview src={form.videoUrl} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-[#102B4C]/20"><Image size={25}/></div>}</div><div className="flex items-center gap-2 p-3"><input value={form.coverImage} onChange={(event) => setForm({...form,coverImage:event.target.value})} placeholder="Image URL" className="min-w-0 flex-1 bg-transparent text-[9px] outline-none"/><label className="cursor-pointer rounded-md bg-[#102B4C] px-3 py-2 text-[9px] font-semibold text-white">{uploadProgress === null ? 'Upload' : `${uploadProgress}%`}<input type="file" accept="image/*" className="hidden" disabled={uploadProgress !== null} onChange={(event) => event.target.files?.[0] && void uploadCover(event.target.files[0])}/></label></div></div></Field>{form.type === 'video' && <><Field label="Video URL"><div className="overflow-hidden rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC]"><input type="text" required value={form.videoUrl} onChange={(event) => setForm({...form,videoUrl:event.target.value})} placeholder="Paste a YouTube, Vimeo or direct video URL" className="w-full bg-transparent px-3.5 py-3 text-[11px] text-[#102B4C] outline-none"/><div className="border-t border-[#102B4C]/8 p-3"><label className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#102B4C]/18 bg-white px-4 py-3 text-[9px] font-semibold text-[#102B4C] transition hover:border-[#060273]/35 ${videoUploadProgress !== null ? 'pointer-events-none opacity-60' : ''}`}><UploadCloud size={14}/>{videoUploadProgress === null ? 'Or upload a video file' : `Uploading · ${videoUploadProgress}%`}<input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime,.mov" className="hidden" disabled={videoUploadProgress !== null} onChange={(event) => event.target.files?.[0] && void uploadVideo(event.target.files[0])}/></label>{videoUploadProgress !== null && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#102B4C]/8"><div className="h-full bg-[#060273] transition-[width]" style={{ width: `${videoUploadProgress}%` }}/></div>}<p className="mt-2 text-[9px] leading-4 text-[#102B4C]/38">MP4, WebM, OGG or MOV · maximum 50MB. YouTube and Vimeo links remain supported.</p></div></div></Field><Field label="Duration (optional)"><input value={form.videoDuration} onChange={(event) => setForm({...form,videoDuration:event.target.value})} placeholder="02:45" className={inputClass}/></Field></>}<Field label="Publication status"><select value={form.status} onChange={(event) => setForm({...form,status:event.target.value as NewsMediaStatus})} className={inputClass}><option value="draft">Draft</option><option value="published">Published</option></select></Field><Field label="Publication date"><input type="datetime-local" value={dateInputValue(form.publishedAt)} onChange={(event) => setForm({...form,publishedAt:event.target.value ? new Date(event.target.value).toISOString() : null})} className={inputClass}/></Field><label className="flex items-start gap-3 rounded-lg border border-[#102B4C]/10 p-4"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({...form,featured:event.target.checked})} className="mt-0.5 accent-[#D64545]"/><span><span className="block text-[11px] font-semibold text-[#102B4C]">Feature on homepage</span><span className="mt-1 block text-[9px] leading-4 text-[#102B4C]/40">This replaces the current featured story.</span></span></label><details className="rounded-lg border border-[#102B4C]/10 p-4"><summary className="cursor-pointer text-[10px] font-semibold text-[#102B4C]">Search appearance</summary><div className="mt-4 space-y-4"><Field label="SEO title"><input value={form.seoTitle} onChange={(event) => setForm({...form,seoTitle:event.target.value})} className={inputClass}/></Field><Field label="SEO description"><textarea rows={3} value={form.seoDescription} onChange={(event) => setForm({...form,seoDescription:event.target.value})} className={`${inputClass} resize-none`}/></Field></div></details></div></div><div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#102B4C]/8 bg-white pt-5"><button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-[10px] font-semibold text-[#102B4C]/45">Cancel</button><button disabled={saving || uploadProgress !== null || videoUploadProgress !== null} className="rounded-lg bg-[#060273] px-5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : form.status === 'published' ? 'Save and publish' : 'Save draft'}</button></div></form></section></div>}
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC] px-3.5 py-3 text-[12px] text-[#102B4C] outline-none focus:border-[#060273]/30 focus:ring-2 focus:ring-[#060273]/5'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-[#102B4C]/52"><span className="mb-2 block uppercase tracking-[0.12em]">{label}</span>{children}</label>
}
