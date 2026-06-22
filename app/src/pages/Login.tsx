import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

interface ProductPreview {
  _id: string
  name: string
  description: string
  image: string
}

interface ShowcaseSlide {
  id: string
  type: 'branding' | 'product'
  title: string
  description: string
  image: string
}

const FALLBACK_LOGO = '/assets/Open Sidebar Logo.jpg'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [brandingLogo, setBrandingLogo] = useState(FALLBACK_LOGO)
  const [products, setProducts] = useState<ProductPreview[]>([])
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(apiUrl('/api/content/branding'))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setBrandingLogo(resolveMediaUrl(data?.logoUrl) || FALLBACK_LOGO)
      })
      .catch(() => {
        setBrandingLogo(FALLBACK_LOGO)
      })

    fetch(apiUrl('/api/products'))
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data.filter(Boolean).slice(0, 5))
        }
      })
      .catch(() => {
        setProducts([])
      })
  }, [])

  const slides = useMemo<ShowcaseSlide[]>(() => {
    const brandingSlide: ShowcaseSlide = {
      id: 'branding-slide',
      type: 'branding',
      title: 'Welcome back',
      description: 'The Bestworth logo shows first, then the slide rotates into live product highlights.',
      image: brandingLogo
    }

    const productSlides = products.map<ShowcaseSlide>((product) => ({
      id: product._id,
      type: 'product',
      title: product.name,
      description: product.description || 'Current products from the live catalog appear here.',
      image: resolveMediaUrl(product.image)
    }))

    return [brandingSlide, ...productSlides]
  }, [brandingLogo, products])

  useEffect(() => {
    if (slides.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % slides.length)
    }, 4500)

    return () => window.clearInterval(interval)
  }, [slides.length])

  useEffect(() => {
    setActiveSlideIndex((current) => Math.min(current, Math.max(slides.length - 1, 0)))
  }, [slides.length])

  const activeSlide = slides[activeSlideIndex] || slides[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (response.status === 503) {
        navigate('/service-unavailable?area=admin')
        return
      }

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('adminToken', data.token)
        navigate('/admin')
      } else {
        setError(data.message || 'Login failed')
      }
    } catch {
      navigate('/service-unavailable?area=admin')
    } finally {
      setLoading(false)
    }
  }

  const goToProducts = () => {
    window.location.href = '/#products'
  }

  return (
    <div className="min-h-screen bg-[#efe2bd]">
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[1.03fr_0.97fr]">
          <section
            className="relative min-h-[32vh] overflow-hidden bg-[#2f2b2c] text-white lg:min-h-screen lg:[clip-path:polygon(0_0,92%_0,100%_100%,0_100%)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(184,134,11,0.2),_transparent_36%)]" />

            <div className="relative flex h-full flex-col justify-between px-5 py-5 sm:px-8 sm:py-8 lg:px-20 lg:py-14">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#d4af37]">
                  Bestworth
                </p>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center py-3 text-center lg:py-6">
                <div className="flex h-[132px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[18px] bg-white/6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:h-[150px] sm:max-w-[250px] lg:h-[210px] lg:max-w-[340px] lg:rounded-[22px]">
                  {activeSlide?.type === 'branding' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 sm:px-6 lg:gap-5 lg:px-8">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)] sm:h-16 sm:w-16 lg:h-20 lg:w-20 lg:rounded-[18px] lg:p-3">
                        <img
                          src={activeSlide.image}
                          alt="Bestworth logo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p className="max-w-[170px] text-[10px] leading-4 text-white/78 sm:max-w-[190px] sm:text-[11px] sm:leading-4 lg:max-w-[200px] lg:text-[12px] lg:leading-5">
                        Bestworth identity shows first before product slides begin.
                      </p>
                    </div>
                  ) : (
                    <img
                      src={activeSlide?.image}
                      alt={activeSlide?.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="mt-4 max-w-[260px] sm:max-w-[320px] lg:mt-6 lg:max-w-[420px]">
                  <h1 className="font-display text-lg tracking-tight sm:text-2xl lg:text-4xl">
                    {activeSlide?.title || 'Welcome back'}
                  </h1>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-white/72 sm:text-[11px] sm:leading-4 lg:line-clamp-3 lg:text-[13px] lg:leading-5">
                    {activeSlide?.description || 'Current products from the live catalog appear here.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:gap-5">
                <div className="flex items-center gap-2">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(index)}
                      className={`rounded-full transition-all ${
                        index === activeSlideIndex
                          ? 'h-2.5 w-8 bg-[#d4af37]'
                          : 'h-2.5 w-2.5 bg-white/28 hover:bg-white/52'
                      }`}
                      aria-label={`Show slide ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={goToProducts}
                  className="inline-flex items-center justify-center rounded-full border border-[#d4af37]/70 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#f0d98a] transition-colors hover:bg-[#d4af37] hover:text-[#2f2b2c] sm:px-5 sm:py-2.5 sm:text-[10px] lg:px-5 lg:py-3 lg:text-[11px] lg:tracking-[0.24em]"
                >
                  View Products
                </button>
              </div>
            </div>
          </section>

          <section
            className="relative flex items-center bg-white px-5 py-8 sm:px-8 sm:py-10 lg:-ml-16 lg:min-h-screen lg:px-24 lg:[clip-path:polygon(12%_0,100%_0,100%_100%,0_100%)]"
          >
            <div className="mx-auto w-full max-w-md lg:max-w-2xl">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.34em] text-[#b8860b] lg:text-left">
                Sign In
              </p>
              <h2 className="mt-3 text-center font-display text-3xl tracking-tight text-[#2f2b2c] sm:text-4xl lg:text-left lg:text-6xl">
                Admin login
              </h2>
              <p className="mt-3 text-center text-[14px] leading-6 text-[#2f2b2c]/60 lg:text-left lg:max-w-[620px] lg:text-[18px] lg:leading-8">
                Continue to the Bestworth administration dashboard.
              </p>

              {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5 lg:mt-10 lg:max-w-[700px] lg:space-y-7">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f2b2c]/55">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="mt-3 w-full rounded-2xl bg-[#eef4ff] px-4 py-4 text-[#2f2b2c] placeholder:text-[#2f2b2c]/30 focus:outline-none focus:ring-2 focus:ring-[#b8860b]/30 lg:px-5 lg:py-5"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f2b2c]/55">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b8860b] transition-colors hover:text-[#2f2b2c]"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="mt-3 w-full rounded-2xl bg-[#eef4ff] px-4 py-4 text-[#2f2b2c] placeholder:text-[#2f2b2c]/30 focus:outline-none focus:ring-2 focus:ring-[#b8860b]/30 lg:px-5 lg:py-5"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#b8860b] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#9b6f08] disabled:cursor-not-allowed disabled:opacity-50 lg:py-5 lg:text-[12px] lg:tracking-[0.28em]"
                >
                  {loading ? 'Authenticating...' : 'Enter Dashboard'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-8 inline-flex text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2f2b2c]/50 transition-colors hover:text-[#b8860b]"
              >
                ← Back to Public Site
              </button>
            </div>
          </section>
        </div>
    </div>
  )
}
