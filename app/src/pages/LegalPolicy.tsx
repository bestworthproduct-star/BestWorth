import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'

interface LegalPolicyProps {
  policyKey: 'privacy_policy' | 'cookie_policy'
  title: string
}

interface PolicyContent {
  html?: string
}

interface ContentChangePayload {
  key?: string
  data?: PolicyContent
}

function buildPolicyDocument(html: string, title: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <title>${title}</title>
    <style>
      html { scroll-behavior: smooth; }
      body { margin: 0 auto; max-width: 920px; padding: 40px 28px 72px; background: #fff; }
      @media (max-width: 640px) { body { padding: 28px 18px 56px; } }
    </style>
  </head>
  <body>${html}</body>
</html>`
}

export default function LegalPolicy({ policyKey, title }: LegalPolicyProps) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPolicy = useCallback(async () => {
    try {
      const response = await fetch(apiUrl(`/api/content/${policyKey}`))
      if (!response.ok) {
        setHtml('')
        return
      }

      const data: PolicyContent = await response.json()
      setHtml(typeof data?.html === 'string' ? data.html : '')
    } catch (error) {
      console.error(`Failed to load ${title}:`, error)
      setHtml('')
    } finally {
      setLoading(false)
    }
  }, [policyKey, title])

  useEffect(() => {
    fetchPolicy()
  }, [fetchPolicy])

  useSocket('content_change', useCallback((payload: ContentChangePayload) => {
    if (payload.key === policyKey) {
      setHtml(typeof payload.data?.html === 'string' ? payload.data.html : '')
      setLoading(false)
    }
  }, [policyKey]))

  const policyDocument = useMemo(() => buildPolicyDocument(html, title), [html, title])

  return (
    <div className="min-h-screen bg-warm-stone text-charcoal">
      <header className="border-b border-white/10 bg-charcoal text-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-5 md:px-10">
          <Link to="/" className="font-display text-xl font-bold tracking-[-0.02em]">
            BESTWORTH
          </Link>
          <Link
            to="/"
            className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 transition-colors hover:text-brass"
          >
            Back to website
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 border-l-4 border-brass pl-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brass">Legal</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        </div>

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center border border-charcoal/10 bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/10 border-t-brass" />
          </div>
        ) : html ? (
          <iframe
            title={title}
            srcDoc={policyDocument}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="min-h-[75vh] w-full border border-charcoal/10 bg-white shadow-sm"
          />
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center border border-charcoal/10 bg-white px-6 text-center">
            <h2 className="font-display text-2xl font-semibold">Policy not published yet</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-charcoal/60">
              This policy will appear here after its Termly HTML is saved from the Footer CMS.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
