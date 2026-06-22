import { Link, useLocation } from 'react-router-dom'

function getAreaFromLocation(pathname: string, search: string) {
  const params = new URLSearchParams(search)
  const requestedArea = params.get('area')

  if (requestedArea === 'admin' || pathname.startsWith('/admin') || pathname.startsWith('/login')) {
    return 'admin'
  }

  return 'public'
}

export default function ServiceUnavailable() {
  const location = useLocation()
  const area = getAreaFromLocation(location.pathname, location.search)
  const homeHref = area === 'admin' ? '/login' : '/'
  const homeLabel = area === 'admin' ? 'Go to Admin Login' : 'Go to Home'

  return (
    <div className="min-h-screen bg-charcoal text-white flex items-center justify-center px-6">
      <div className="w-full max-w-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-12 shadow-2xl text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-brass font-semibold">503 Error</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl tracking-tight">Service temporarily unavailable</h1>
        <p className="mt-4 text-base md:text-lg text-white/75 leading-relaxed">
          The site is reachable, but the database is currently unavailable. Please try again shortly.
        </p>
        <div className="mt-8">
          <Link
            to={homeHref}
            className="inline-flex items-center justify-center px-6 py-3 bg-brass text-white text-sm uppercase tracking-[0.22em] font-semibold hover:bg-brass/90 transition-colors"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
