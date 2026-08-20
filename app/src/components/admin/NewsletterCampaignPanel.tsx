import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, History, Mail, Send, ShieldCheck, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'
import { useSocket } from '@/hooks/useSocket'

interface NewsOption {
  _id: string
  title: string
  slug: string
  excerpt: string
  coverImage?: string
  publishedAt: string
}

interface Campaign {
  _id: string
  post?: { _id: string; title: string; slug: string }
  subject: string
  status: 'sending' | 'sent' | 'partial' | 'failed'
  isTest: boolean
  testEmail?: string
  recipientCount: number
  sentCount: number
  failedCount: number
  initiatedBy?: { fullName?: string; username?: string }
  createdAt: string
  lastError?: string
}

export default function NewsletterCampaignPanel() {
  const token = localStorage.getItem('adminToken')
  const [articles, setArticles] = useState<NewsOption[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [busy, setBusy] = useState<'test' | 'send' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [resendRequired, setResendRequired] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [optionsResponse, campaignsResponse] = await Promise.all([
        fetch(apiUrl('/api/newsletter/admin/news-options'), { headers }),
        fetch(apiUrl('/api/newsletter/admin/campaigns'), { headers })
      ])
      const optionsData = await optionsResponse.json()
      const campaignsData = await campaignsResponse.json()
      if (!optionsResponse.ok) throw new Error(optionsData.message || 'Could not load newsletter articles.')
      if (!campaignsResponse.ok) throw new Error(campaignsData.message || 'Could not load campaign history.')
      setArticles(optionsData.items || [])
      setSubscriberCount(optionsData.subscriberCount || 0)
      setCampaigns(campaignsData.campaigns || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load newsletter controls.')
    }
  }, [token])

  useEffect(() => { void loadData() }, [loadData])
  useSocket('newsletter_campaign_change', loadData)

  const selected = useMemo(() => articles.find((article) => article._id === selectedId) || null, [articles, selectedId])
  const alreadySent = useMemo(() => campaigns.some((campaign) =>
    !campaign.isTest && campaign.post?._id === selectedId && ['sent', 'partial'].includes(campaign.status)
  ), [campaigns, selectedId])

  const prepare = () => {
    const article = articles[0]
    if (!article) { setError('Publish a news article before preparing a subscriber email.'); return }
    setSelectedId(article._id)
    setSubject(`${article.title} | Bestworth News`)
    setPreviewText(article.excerpt)
    setNotice('')
    setError('')
    setConfirming(false)
    setResendRequired(false)
    setComposerOpen(true)
  }

  const selectArticle = (id: string) => {
    const article = articles.find((item) => item._id === id)
    setSelectedId(id)
    if (article) { setSubject(`${article.title} | Bestworth News`); setPreviewText(article.excerpt) }
    setConfirming(false)
    setResendRequired(false)
    setError('')
  }

  const request = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    if (!response.ok) {
      const requestError = new Error(data.message || 'Request failed') as Error & { code?: string }
      requestError.code = data.code
      throw requestError
    }
    return data
  }

  const sendTest = async () => {
    setBusy('test'); setError(''); setNotice('')
    try {
      const data = await request('/api/newsletter/admin/test', { postId: selectedId, subject, previewText, email: testEmail })
      setNotice(data.message)
      await loadData()
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : 'Test email failed.') }
    finally { setBusy(null) }
  }

  const sendCampaign = async () => {
    setBusy('send'); setError(''); setNotice('')
    try {
      const data = await request('/api/newsletter/admin/send', {
        postId: selectedId, subject, previewText, confirmResend: resendRequired || alreadySent
      })
      setNotice(data.message)
      setConfirming(false)
      await loadData()
    } catch (sendError) {
      const typedError = sendError as Error & { code?: string }
      if (typedError.code === 'RESEND_CONFIRMATION_REQUIRED') setResendRequired(true)
      setError(typedError.message || 'Could not start delivery.')
    } finally { setBusy(null) }
  }

  return (
    <>
      <section className="rounded-lg border border-[#102B4C]/10 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[#F0F3F8] p-2.5 text-[#060273]"><Mail size={15}/></div>
            <div><h3 className="text-[12px] font-semibold text-[#102B4C]">News delivery</h3><p className="mt-1 max-w-xl text-[10px] leading-4 text-[#102B4C]/42">Send a published news article to active subscribers. Video content is excluded by the server.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-[#102B4C]/8 bg-[#F7F9FC] px-3 py-2 text-[10px] text-[#102B4C]/55"><span className="font-semibold text-[#102B4C]">{subscriberCount}</span> active</div>
            <button onClick={() => setHistoryOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-[#102B4C]/10 px-3.5 py-2 text-[10px] font-semibold text-[#102B4C]/65"><History size={13}/> History</button>
            <button onClick={prepare} disabled={!articles.length} className="inline-flex items-center gap-2 rounded-md bg-[#102B4C] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40"><Send size={13}/> Prepare email</button>
          </div>
        </div>
        {error && !composerOpen && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700">{error}</p>}
      </section>

      {composerOpen && selected && <div className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-5">
        <div className="absolute inset-0 bg-[#102B4C]/60 backdrop-blur-sm" onClick={() => !busy && setComposerOpen(false)}/>
        <section className="relative max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl [scrollbar-width:thin]">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#102B4C]/8 bg-white px-5 py-4 sm:px-7"><div><h2 className="text-[15px] font-semibold text-[#102B4C]">Prepare subscriber email</h2><p className="mt-1 text-[10px] text-[#102B4C]/40">Owner-only delivery · published news only</p></div><button onClick={() => setComposerOpen(false)} disabled={Boolean(busy)} className="p-2 text-[#102B4C]/35"><X size={17}/></button></header>
          <div className="grid gap-7 p-5 lg:grid-cols-[0.82fr_1.18fr] lg:p-7">
            <div className="space-y-5">
              <Field label="News article"><select value={selectedId} onChange={(event) => selectArticle(event.target.value)} className={inputClass}>{articles.map((article) => <option key={article._id} value={article._id}>{article.title}</option>)}</select></Field>
              <Field label="Email subject"><input maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass}/><span className="mt-1 block text-right text-[9px] text-[#102B4C]/30">{subject.length}/200</span></Field>
              <Field label="Inbox preview"><textarea rows={4} maxLength={300} value={previewText} onChange={(event) => setPreviewText(event.target.value)} className={`${inputClass} resize-none`}/><span className="mt-1 block text-right text-[9px] text-[#102B4C]/30">{previewText.length}/300</span></Field>
              <div className="rounded-lg border border-[#102B4C]/9 bg-[#F7F9FC] p-4"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#102B4C]"><ShieldCheck size={14} className="text-[#060273]"/> Delivery checks</div><ul className="mt-3 space-y-2 text-[9px] leading-4 text-[#102B4C]/48"><li>Article is published news, not video.</li><li>{subscriberCount} active recipient{subscriberCount === 1 ? '' : 's'} will be resolved again at send time.</li><li>Each recipient receives an individual unsubscribe link.</li></ul></div>
              <Field label="Test recipient"><div className="flex gap-2"><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="you@company.com" className={inputClass}/><button type="button" onClick={() => void sendTest()} disabled={busy !== null || !testEmail || !subject} className="shrink-0 rounded-md border border-[#102B4C]/12 px-4 text-[10px] font-semibold text-[#102B4C] disabled:opacity-40">{busy === 'test' ? 'Sending…' : 'Send test'}</button></div></Field>
              {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-700">{notice}</p>}
              {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700">{error}</p>}
            </div>
            <div><p className="mb-2 text-[9px] font-semibold uppercase tracking-[.14em] text-[#102B4C]/35">Email preview</p><div className="overflow-hidden rounded-lg border border-[#102B4C]/10 bg-[#F3F6FA] p-3 sm:p-5"><div className="mx-auto max-w-[620px] overflow-hidden rounded-lg border border-[#102B4C]/10 bg-white"><div className="h-1 bg-[#D64545]"/><div className="bg-[#102B4C] px-6 py-5 text-[11px] font-semibold tracking-[.16em] text-white">BESTWORTH <span className="text-white/45">PRODUCTS LIMITED</span></div><div className="p-6">{selected.coverImage && <img src={resolveMediaUrl(selected.coverImage)} alt="" className="mb-5 aspect-[16/8] w-full rounded-md object-cover"/>}<p className="text-[9px] font-semibold uppercase tracking-[.14em] text-[#D64545]">Company news · {new Date(selected.publishedAt).toLocaleDateString()}</p><h3 className="mt-3 text-xl font-semibold leading-tight text-[#102B4C]">{selected.title}</h3><p className="mt-3 text-[12px] leading-5 text-[#102B4C]/65">{selected.excerpt}</p><span className="mt-5 inline-block rounded bg-[#060273] px-4 py-2.5 text-[9px] font-semibold text-white">Read full article</span></div><div className="border-t border-[#102B4C]/8 bg-[#EDF2F7] px-6 py-5 text-[9px] leading-4 text-[#102B4C]/48">You received this email because you subscribed to Bestworth company news. <u>Unsubscribe</u>.</div></div></div></div>
          </div>
          <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[#102B4C]/8 bg-white px-5 py-4 sm:px-7"><button onClick={() => setComposerOpen(false)} disabled={Boolean(busy)} className="px-4 py-2 text-[10px] font-semibold text-[#102B4C]/45">Close</button><button onClick={() => { setError(''); setConfirming(true) }} disabled={Boolean(busy) || !subject || !subscriberCount} className="inline-flex items-center gap-2 rounded-md bg-[#060273] px-5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40"><Send size={13}/> Review and send</button></footer>
        </section>
        {confirming && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#102B4C]/35 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F3F8] text-[#060273]"><ShieldCheck size={17}/></div><h3 className="mt-4 text-[15px] font-semibold text-[#102B4C]">Confirm subscriber delivery</h3><p className="mt-2 text-[11px] leading-5 text-[#102B4C]/55">Send “{selected.title}” to {subscriberCount} active subscriber{subscriberCount === 1 ? '' : 's'}? Delivery cannot be recalled.</p>{(alreadySent || resendRequired) && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">This article has previously been sent. Confirming will send it again.</p>}<div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirming(false)} disabled={Boolean(busy)} className="px-4 py-2 text-[10px] font-semibold text-[#102B4C]/50">Go back</button><button onClick={() => void sendCampaign()} disabled={Boolean(busy)} className="rounded-md bg-[#102B4C] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{busy === 'send' ? 'Starting delivery…' : (alreadySent || resendRequired) ? 'Send again' : 'Start delivery'}</button></div></div></div>}
      </div>}

      {historyOpen && <div className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-5"><div className="absolute inset-0 bg-[#102B4C]/55 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}/><section className="relative max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#102B4C]/8 px-5 py-4"><div><h2 className="text-[14px] font-semibold text-[#102B4C]">Delivery history</h2><p className="mt-1 text-[9px] text-[#102B4C]/38">Production and test email audit trail</p></div><button onClick={() => setHistoryOpen(false)} className="p-2 text-[#102B4C]/35"><X size={16}/></button></header><div className="max-h-[70vh] overflow-y-auto [scrollbar-width:thin]">{campaigns.length ? <div className="divide-y divide-[#102B4C]/7">{campaigns.map((campaign) => <div key={campaign._id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${campaign.status === 'sent' ? 'bg-emerald-500' : campaign.status === 'sending' ? 'bg-blue-500' : campaign.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'}`}/><p className="truncate text-[11px] font-semibold text-[#102B4C]">{campaign.post?.title || 'Removed article'}</p>{campaign.isTest && <span className="rounded bg-[#F0F3F8] px-2 py-0.5 text-[8px] font-semibold uppercase text-[#060273]">Test</span>}</div><p className="mt-1 truncate text-[9px] text-[#102B4C]/40">{campaign.subject}{campaign.testEmail ? ` · ${campaign.testEmail}` : ''}</p><p className="mt-1 text-[9px] text-[#102B4C]/32">{new Date(campaign.createdAt).toLocaleString()} · {campaign.initiatedBy?.fullName || campaign.initiatedBy?.username || 'Owner'}</p></div><div className="text-left sm:text-right"><p className="text-[9px] font-semibold capitalize text-[#102B4C]/60">{campaign.status}</p><p className="mt-1 text-[9px] text-[#102B4C]/38">{campaign.sentCount} sent · {campaign.failedCount} failed</p></div></div>)}</div> : <div className="p-14 text-center"><Clock3 className="mx-auto text-[#102B4C]/15"/><p className="mt-3 text-[10px] text-[#102B4C]/40">No email campaigns yet.</p></div>}</div></section></div>}
    </>
  )
}

const inputClass = 'w-full rounded-md border border-[#102B4C]/10 bg-[#F7F9FC] px-3 py-2.5 text-[11px] text-[#102B4C] outline-none focus:border-[#060273]/30 focus:ring-2 focus:ring-[#060273]/5'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[9px] font-semibold uppercase tracking-[.12em] text-[#102B4C]/45"><span className="mb-2 block">{label}</span>{children}</label>
}
