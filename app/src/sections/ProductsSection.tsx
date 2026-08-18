import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

interface Product {
  _id: string
  name: string
  category: string
  description: string
  image: string
  featured?: boolean
}

interface Category {
  id: string
  name: string
}

interface ContentChangePayload {
  key?: string
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'nails', name: 'NAILS' },
  { id: 'screws', name: 'SCREWS' },
  { id: 'bolts', name: 'BOLTS & NUTS' },
  { id: 'building', name: 'BUILDING MATERIALS' },
]

const getProductsPerPage = (width: number) => {
  if (width < 640) return 3
  return 4
}

const formatNumber = (value: number) => String(value).padStart(2, '0')

export default function ProductsSection() {
  const [activeFilter, setActiveFilter] = useState('all')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [productsPerPage, setProductsPerPage] = useState(() =>
    getProductsPerPage(typeof window === 'undefined' ? 1280 : window.innerWidth)
  )
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const sectionRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const gridHeadingRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const categoryRailRef = useRef<HTMLDivElement>(null)
  const modalScrollRef = useRef<HTMLDivElement>(null)

  const fetchCategories = useCallback(() => {
    fetch(apiUrl('/api/content/categories'))
      .then((response) => response.ok ? response.json() : DEFAULT_CATEGORIES)
      .then((data) => setCategories(Array.isArray(data) ? data : DEFAULT_CATEGORIES))
      .catch(() => setCategories(DEFAULT_CATEGORIES))
  }, [])

  const fetchProducts = useCallback(() => {
    fetch(apiUrl('/api/products'))
      .then((response) => response.json())
      .then((data) => setAllProducts(Array.isArray(data) ? data : []))
      .catch((error) => console.error('Failed to load products:', error))
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [fetchCategories, fetchProducts])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase())
      setCurrentPage(0)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const handleResize = () => setProductsPerPage(getProductsPerPage(window.innerWidth))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!selectedProduct) return

    const scrollY = window.scrollY
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedProduct(null)
    }

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      window.removeEventListener('keydown', handleKeyDown)
      window.scrollTo(0, scrollY)
    }
  }, [selectedProduct])

  useEffect(() => {
    if (!selectedProduct) return

    const preventBackgroundScroll = (event: WheelEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target || !modalScrollRef.current?.contains(target)) {
        event.preventDefault()
      }
    }

    window.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true })
    window.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true })
    return () => {
      window.removeEventListener('wheel', preventBackgroundScroll, true)
      window.removeEventListener('touchmove', preventBackgroundScroll, true)
    }
  }, [selectedProduct])

  useSocket('product_change', fetchProducts)
  useSocket('content_change', useCallback((payload: ContentChangePayload) => {
    if (payload.key === 'categories') fetchCategories()
  }, [fetchCategories]))

  const getCategoryName = useCallback((categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.name || categoryId,
  [categories])

  const filteredProducts = useMemo(() => {
    const categoryFiltered = activeFilter === 'all'
      ? allProducts
      : allProducts.filter((product) => product.category === activeFilter)

    if (!debouncedSearch) return categoryFiltered

    return categoryFiltered.filter((product) => {
      const searchableText = [
        product.name,
        product.description,
        getCategoryName(product.category),
      ].join(' ').toLowerCase()
      return searchableText.includes(debouncedSearch)
    })
  }, [activeFilter, allProducts, debouncedSearch, getCategoryName])

  const featuredProduct = filteredProducts.find((product) => product.featured) || null
  const gridProducts = featuredProduct
    ? filteredProducts.filter((product) => product._id !== featuredProduct._id)
    : filteredProducts
  const firstPageGridCapacity = Math.max(productsPerPage - (featuredProduct ? 1 : 0), 1)
  const remainingAfterFirstPage = Math.max(gridProducts.length - firstPageGridCapacity, 0)
  const totalPages = filteredProducts.length === 0
    ? 0
    : 1 + Math.ceil(remainingAfterFirstPage / productsPerPage)
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages - 1, 0))
  const pageStart = safeCurrentPage === 0
    ? 0
    : firstPageGridCapacity + ((safeCurrentPage - 1) * productsPerPage)
  const pageSize = safeCurrentPage === 0 ? firstPageGridCapacity : productsPerPage
  const visibleProducts = gridProducts.slice(pageStart, pageStart + pageSize)

  const paginationItems = useMemo<Array<number | 'ellipsis-start' | 'ellipsis-end'>>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index)

    const pages = new Set([0, totalPages - 1, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1])
    const validPages = [...pages].filter((page) => page >= 0 && page < totalPages).sort((a, b) => a - b)
    const result: Array<number | 'ellipsis-start' | 'ellipsis-end'> = []

    validPages.forEach((page, index) => {
      const previousPage = validPages[index - 1]
      if (index > 0 && page - previousPage > 1) {
        result.push(page < safeCurrentPage ? 'ellipsis-start' : 'ellipsis-end')
      }
      result.push(page)
    })
    return result
  }, [safeCurrentPage, totalPages])

  const selectCategory = (category: string) => {
    setActiveFilter(category)
    setSearchInput('')
    setDebouncedSearch('')
    setCurrentPage(0)
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (value.trim()) setActiveFilter('all')
  }

  const clearSearch = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setCurrentPage(0)
  }

  const goToPage = (page: number) => {
    if (totalPages === 0) return
    setCurrentPage(Math.min(Math.max(page, 0), totalPages - 1))
    window.requestAnimationFrame(() => {
      gridHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const scrollCategoryRail = (direction: number) => {
    categoryRailRef.current?.scrollBy({ left: direction * 280, behavior: 'smooth' })
  }

  const startProductInquiry = (product: Product) => {
    window.dispatchEvent(new CustomEvent('bestworth:product-inquiry', {
      detail: {
        productName: product.name,
        categoryName: getCategoryName(product.category),
      },
    }))
    setSelectedProduct(null)
    window.setTimeout(() => {
      document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  useGSAP(() => {
    if (!headerRef.current) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const elements = headerRef.current.querySelectorAll('.reveal-item')
    gsap.fromTo(
      elements,
      { opacity: 0, y: reduceMotion ? 0 : 40 },
      {
        opacity: 1,
        y: 0,
        duration: reduceMotion ? 0 : 0.9,
        stagger: reduceMotion ? 0 : 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: headerRef.current,
          start: 'top 78%',
          toggleActions: 'play none none none',
        },
      }
    )
  }, { scope: sectionRef })

  useGSAP(() => {
    if (!gridRef.current || visibleProducts.length === 0) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cards = gridRef.current.querySelectorAll('.product-card')
    gsap.fromTo(
      cards,
      { opacity: 0, y: reduceMotion ? 0 : 22, scale: reduceMotion ? 1 : 0.985 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: reduceMotion ? 0 : 0.5,
        stagger: reduceMotion ? 0 : 0.04,
        ease: 'power3.out',
      }
    )
  }, {
    scope: gridRef,
    dependencies: [safeCurrentPage, activeFilter, debouncedSearch, visibleProducts.length],
  })

  const filters = [
    { label: 'ALL PRODUCTS', value: 'all' },
    ...categories.map((category) => ({ label: category.name.toUpperCase(), value: category.id })),
  ]

  return (
    <section
      id="products"
      ref={sectionRef}
      className="relative z-10 min-h-screen bg-warm-stone py-14 md:py-[100px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div ref={headerRef}>
          <span className="reveal-item section-label section-label-light text-[12px]">PRODUCT RANGE</span>
          <h2 className="reveal-item mt-3 font-display text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-charcoal md:text-[44px]">
            Engineered for Every Build
          </h2>
          <p className="reveal-item mt-3 max-w-[650px] font-body text-[15px] leading-relaxed text-charcoal/70 md:text-[17px]">
            Search and explore our comprehensive catalog of dependable fastening and building solutions.
          </p>

          <div className="reveal-item mt-10 grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="order-2 min-w-0 lg:order-1">
              <div className="sm:hidden">
                <label htmlFor="product-category" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-charcoal/45">
                  Product Category
                </label>
                <select
                  id="product-category"
                  value={activeFilter}
                  onChange={(event) => selectCategory(event.target.value)}
                  className="w-full border border-charcoal/15 bg-white px-4 py-3.5 font-body text-sm font-semibold text-charcoal outline-none focus:border-brass rounded-lg"
                >
                  {filters.map((filter) => (
                    <option key={filter.value} value={filter.value}>{filter.label}</option>
                  ))}
                </select>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => scrollCategoryRail(-1)}
                  className="hidden h-11 w-11 shrink-0 items-center justify-center border border-charcoal/15 text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-white lg:flex"
                  aria-label="Scroll categories left"
                >
                  <ChevronLeft size={18} />
                </button>
                <div
                  ref={categoryRailRef}
                  className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => selectCategory(filter.value)}
                  className={`shrink-0 snap-start border px-5 py-3 font-body text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors rounded-full ${
                    activeFilter === filter.value
                          ? 'border-brass bg-brass text-white'
                          : 'border-charcoal/15 bg-white text-charcoal hover:border-charcoal'
                  }`}
                >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => scrollCategoryRail(1)}
                  className="hidden h-11 w-11 shrink-0 items-center justify-center border border-charcoal/15 text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-white lg:flex"
                  aria-label="Scroll categories right"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="relative order-1 lg:order-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40" size={18} />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search products, materials, or categories..."
                className="w-full border border-charcoal/15 bg-white py-3.5 pl-12 pr-11 font-body text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/35 focus:border-brass rounded-lg"
                aria-label="Search all products"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-charcoal/45 hover:text-brass"
                  aria-label="Clear product search"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div ref={gridHeadingRef} className="scroll-mt-24 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-charcoal/50">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'} {debouncedSearch ? 'Found' : 'Available'}
            </p>
            {debouncedSearch && (
              <p className="font-body text-xs text-charcoal/55">
                Searching all categories for “{searchInput.trim()}”
              </p>
            )}
          </div>
        </div>

        {featuredProduct && safeCurrentPage === 0 && (
          <button
            type="button"
            onClick={() => setSelectedProduct(featuredProduct)}
            className="group mt-7 grid w-full overflow-hidden border border-charcoal/10 bg-charcoal text-left shadow-[0_18px_50px_rgba(6,2,115,0.12)] md:h-[280px] md:grid-cols-[0.82fr_1.18fr] rounded-lg"
          >
            <div className="relative h-[190px] overflow-hidden sm:h-[220px] md:h-full md:min-h-0">
              <img
                src={resolveMediaUrl(featuredProduct.image)}
                alt={featuredProduct.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035] motion-reduce:transition-none"
              />
              <span className="absolute left-4 top-4 bg-brass px-3 py-1.5 font-body text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                Featured Product
              </span>
            </div>
            <div className="flex flex-col justify-center p-6 text-white md:p-8 lg:p-10">
              <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-brass">
                {getCategoryName(featuredProduct.category)}
              </span>
              <h3 className="mt-2 font-display text-2xl font-medium tracking-[-0.025em] md:text-[28px]">
                {featuredProduct.name}
              </h3>
              <p className="mt-3 line-clamp-3 max-w-xl font-body text-sm leading-6 text-white/70 md:text-[15px]">
                {featuredProduct.description}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 font-body text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                View product <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </button>
        )}

        {visibleProducts.length > 0 ? (
          <div
            ref={gridRef}
            className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-7"
          >
            {visibleProducts.map((product) => (
              <button
                key={product._id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="product-card group grid min-h-[150px] grid-cols-[118px_minmax(0,1fr)] overflow-hidden border border-charcoal/10 bg-white text-left shadow-[0_12px_35px_rgba(6,2,115,0.045)] transition-all duration-500 hover:-translate-y-1 hover:border-charcoal/25 hover:shadow-[0_20px_45px_rgba(6,2,115,0.09)] motion-reduce:transform-none motion-reduce:transition-none sm:block sm:h-full rounded-lg"
              >
                <div className="relative h-full min-h-[150px] overflow-hidden bg-charcoal/[0.03] sm:aspect-[4/3] sm:h-auto sm:min-h-0">
                  {product.featured && (
                    <span className="absolute left-3 top-3 z-10 bg-brass px-2.5 py-1 font-body text-[8px] font-bold uppercase tracking-[0.12em] text-white sm:text-[9px]">
                      Featured
                    </span>
                  )}
                  <img
                    src={resolveMediaUrl(product.image)}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                  />
                </div>
                <div className="flex min-w-0 flex-col justify-center p-4 sm:p-5">
                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.13em] text-brass sm:text-[10px]">
                    {getCategoryName(product.category)}
                  </span>
                  <h3 className="mt-1 font-display text-base font-medium leading-[1.2] tracking-[-0.01em] text-charcoal sm:text-[19px]">
                    {product.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 font-body text-xs leading-[1.6] text-charcoal/65 sm:text-[14px]">
                    {product.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 font-body text-[8px] font-bold uppercase tracking-[0.16em] text-charcoal/45 transition-colors group-hover:text-brass sm:text-[9px]">
                    View details <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : !featuredProduct ? (
          <div className="mt-8 flex min-h-[320px] flex-col items-center justify-center border border-charcoal/10 bg-white px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center border border-brass/20 bg-brass/[0.06] text-brass">
              <Search size={24} />
            </div>
            <h3 className="mt-5 font-display text-2xl font-medium text-charcoal">No matching products</h3>
            <p className="mt-2 max-w-md font-body text-sm leading-6 text-charcoal/55">
              Try a different product name, material, or category.
            </p>
            <button
              type="button"
              onClick={clearSearch}
              className="mt-6 bg-charcoal px-6 py-3 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-brass"
            >
              Clear Search
            </button>
          </div>
        ) : null}

        {totalPages > 1 && (
          <nav className="mt-10 flex flex-col items-center justify-between gap-5 border-t border-charcoal/10 pt-6 sm:flex-row" aria-label="Product pages">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-charcoal/45">
              Page {formatNumber(safeCurrentPage + 1)} / {formatNumber(totalPages)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(safeCurrentPage - 1)}
                disabled={safeCurrentPage === 0}
                className="flex h-11 w-11 items-center justify-center border border-charcoal/15 text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous product page"
              >
                <ChevronLeft size={18} />
              </button>
              {paginationItems.map((item) => typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  aria-current={safeCurrentPage === item ? 'page' : undefined}
                  className={`h-11 min-w-11 border px-3 font-body text-[10px] font-bold transition-colors ${
                    safeCurrentPage === item
                      ? 'border-brass bg-brass text-white'
                      : 'border-charcoal/15 bg-white text-charcoal hover:border-charcoal'
                  }`}
                >
                  {formatNumber(item + 1)}
                </button>
              ) : (
                <span key={item} className="px-1 text-charcoal/35">…</span>
              ))}
              <button
                type="button"
                onClick={() => goToPage(safeCurrentPage + 1)}
                disabled={safeCurrentPage === totalPages - 1}
                className="flex h-11 w-11 items-center justify-center border border-charcoal bg-charcoal text-white transition-colors hover:border-brass hover:bg-brass disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next product page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </nav>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-8" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
          <button
            type="button"
            className="absolute inset-0 bg-charcoal/90 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
            aria-label="Close product details"
          />
          <div className="relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-t-2xl border border-white/10 bg-white shadow-[0_35px_100px_rgba(0,0,0,0.45)] sm:rounded-2xl md:max-h-[88vh]">
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute right-3 top-3 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal text-white shadow-lg transition-colors hover:bg-brass sm:right-4 sm:top-4 sm:h-10 sm:w-10 sm:rounded-none"
              aria-label="Close product details"
            >
              <X size={19} />
            </button>
            <div
              ref={modalScrollRef}
              data-lenis-prevent
              className="grid max-h-[92dvh] overscroll-contain overflow-y-auto md:max-h-[88vh] md:grid-cols-[0.95fr_1.05fr]"
            >
              <div className="relative min-h-[190px] bg-charcoal/[0.04] sm:min-h-[260px] md:min-h-[560px]">
                <img
                  src={resolveMediaUrl(selectedProduct.image)}
                  alt={selectedProduct.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {selectedProduct.featured && (
                  <span className="absolute left-4 top-4 bg-brass px-3 py-1.5 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-white sm:left-5 sm:top-5 sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.16em]">
                    Featured Product
                  </span>
                )}
              </div>
              <div className="flex flex-col justify-center p-5 sm:p-7 md:p-10 lg:p-14">
                <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-brass">
                  {getCategoryName(selectedProduct.category)}
                </span>
                <h2 id="product-modal-title" className="mt-3 pr-10 font-display text-2xl font-medium leading-[1.05] tracking-[-0.03em] text-charcoal sm:mt-4 sm:text-3xl md:text-5xl">
                  {selectedProduct.name}
                </h2>
                <div className="my-5 h-px w-16 bg-brass sm:my-7" />
                <p className="font-body text-sm leading-6 text-charcoal/70 sm:leading-7 md:text-base">
                  {selectedProduct.description}
                </p>
                <button
                  type="button"
                  onClick={() => startProductInquiry(selectedProduct)}
                  className="mt-6 inline-flex items-center justify-center gap-3 bg-charcoal px-7 py-3.5 font-body text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brass sm:mt-9 sm:py-4"
                >
                  Send an Inquiry <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
