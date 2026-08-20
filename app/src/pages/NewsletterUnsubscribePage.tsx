import { useState } from 'react'
import { CheckCircle2, MailX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiUrl } from '@/lib/api'

export default function NewsletterUnsubscribePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'ready' | 'working' | 'done' | 'error'>(token ? 'ready' : 'error')
  const [message, setMessage] = useState(token ? '' : 'This unsubscribe link is incomplete or invalid.')

  const unsubscribe = async () => {
    setStatus('working')
    try {
      const response = await fetch(apiUrl('/api/newsletter/unsubscribe'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'We could not update your subscription.')
      setMessage(data.message)
      setStatus('done')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not update your subscription.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F6FA] px-4 py-10 text-[#102B4C] sm:py-16">
      <main className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-[#102B4C]/10 bg-white shadow-sm">
        <div className="h-1 bg-[#D64545]"/>
        <header className="bg-[#102B4C] px-6 py-6 sm:px-9"><Link to="/" className="text-[14px] font-semibold tracking-[.15em] text-white">BESTWORTH <span className="text-white/45">PRODUCTS LIMITED</span></Link></header>
        <section className="px-6 py-10 sm:px-9 sm:py-12">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F0F3F8] text-[#060273]'}`}>{status === 'done' ? <CheckCircle2 size={20}/> : <MailX size={20}/>}</div>
          <h1 className="mt-5 text-xl font-semibold">{status === 'done' ? 'Subscription updated' : 'Unsubscribe from company news'}</h1>
          <p className="mt-3 text-[13px] leading-6 text-[#102B4C]/58">{status === 'done' || status === 'error' ? message : 'You will no longer receive Bestworth news articles at this email address. This does not affect direct replies to inquiries you send us.'}</p>
          {status === 'ready' && <button onClick={() => void unsubscribe()} className="mt-7 rounded-md bg-[#102B4C] px-5 py-3 text-[11px] font-semibold text-white">Confirm unsubscribe</button>}
          {status === 'working' && <button disabled className="mt-7 rounded-md bg-[#102B4C] px-5 py-3 text-[11px] font-semibold text-white opacity-60">Updating…</button>}
          {(status === 'done' || status === 'error') && <Link to="/" className="mt-7 inline-block text-[11px] font-semibold text-[#060273]">Return to Bestworth</Link>}
        </section>
      </main>
    </div>
  )
}
