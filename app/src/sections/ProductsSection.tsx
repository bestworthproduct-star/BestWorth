import { useState, useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
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

export default function ProductsSection() {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])

  const sectionRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)

  const filterProducts = useCallback((category: string, productsList: Product[]) => {
    if (category === 'all') return productsList
    return productsList.filter((p) => p.category === category)
  }, [])

  const fetchCategories = useCallback(() => {
    fetch(apiUrl('/api/content/categories'))
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          setCategories(data)
        } else {
          // Default categories if none in CMS
          setCategories([
            { id: 'nails', name: 'NAILS' },
            { id: 'screws', name: 'SCREWS' },
            { id: 'bolts', name: 'BOLTS & NUTS' },
            { id: 'building', name: 'BUILDING MATERIALS' }
          ])
        }
      })
      .catch(() => {
        setCategories([
          { id: 'nails', name: 'NAILS' },
          { id: 'screws', name: 'SCREWS' },
          { id: 'bolts', name: 'BOLTS & NUTS' },
          { id: 'building', name: 'BUILDING MATERIALS' }
        ])
      })
  }, [])

  const fetchProducts = useCallback(() => {
    fetch(apiUrl('/api/products'))
      .then(res => res.json())
      .then(data => {
        setAllProducts(data)
        setDisplayedProducts(filterProducts(activeFilter, data))
      })
      .catch(err => console.error('Error fetching products:', err))
  }, [activeFilter, filterProducts])

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [fetchCategories, fetchProducts])

  useSocket('product_change', fetchProducts)
  useSocket('content_change', (payload: any) => {
    if (payload.key === 'categories') {
      fetchCategories()
    }
  })

  useEffect(() => {
    if (allProducts.length > 0) {
      setDisplayedProducts(filterProducts(activeFilter, allProducts))
    }
  }, [activeFilter, allProducts, filterProducts])

  const filters = [
    { label: 'ALL', value: 'all' },
    ...categories.map(c => ({ label: c.name.toUpperCase(), value: c.id }))
  ]

  // Initial scroll reveal animation
  useGSAP(() => {
    if (!sectionRef.current) return

    if (headerRef.current) {
      const els = headerRef.current.querySelectorAll('.reveal-item')
      gsap.fromTo(
        els,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      )
    }

    if (gridRef.current) {
      const cards = gridRef.current.querySelectorAll('.product-card')
      gsap.fromTo(
        cards,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      )
    }
  }, { scope: sectionRef })

  // Filter animation
  useEffect(() => {
    if (!gridRef.current || isAnimating.current) return
    isAnimating.current = true

    const currentCards = gridRef.current.querySelectorAll('.product-card')

    gsap.to(currentCards, {
      opacity: 0,
      scale: 0.95,
      duration: 0.3,
      ease: 'power2.inOut',
      stagger: 0.03,
      onComplete: () => {
        const filtered = filterProducts(activeFilter, allProducts)
        setDisplayedProducts(filtered)

        // After React re-render, animate new cards in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (gridRef.current) {
              const newCards = gridRef.current.querySelectorAll('.product-card')
              gsap.fromTo(
                newCards,
                { opacity: 0, scale: 0.95 },
                {
                  opacity: 1,
                  scale: 1,
                  duration: 0.4,
                  ease: 'power2.out',
                  stagger: 0.05,
                  onComplete: () => {
                    isAnimating.current = false
                  },
                }
              )
            }
          })
        })
      },
    })
  }, [activeFilter, filterProducts])

  return (
    <section
      id="products"
      ref={sectionRef}
      className="bg-warm-stone relative z-10 min-h-screen py-16 md:py-[120px]"
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div ref={headerRef}>
          <span className="reveal-item section-label section-label-light">
            PRODUCT RANGE
          </span>
          <h2 className="reveal-item font-display font-medium text-[36px] md:text-[72px] text-charcoal leading-[1] tracking-[-0.025em] mt-4">
            Engineered for Every Build
          </h2>
          <p className="reveal-item font-body text-lg md:text-xl text-charcoal leading-relaxed mt-4 max-w-[600px]">
            From roofing nails to masonry screws, our comprehensive catalog covers every fastening need in modern construction.
          </p>

          {/* Filter Tabs */}
          <div className="reveal-item flex flex-wrap gap-3 mt-10">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={`btn-filter ${activeFilter === filter.value ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mt-12"
        >
          {displayedProducts.map((product) => (
            <div
              key={product._id}
              className={`product-card bg-white group cursor-pointer transition-all duration-[400ms] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(43,43,43,0.06)] ${
                product.featured ? 'sm:col-span-2' : ''
              }`}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* Image */}
              <div
                className={`overflow-hidden relative ${
                  product.featured ? 'aspect-[16/10]' : 'aspect-square'
                }`}
              >
                {product.featured && (
                  <span className="absolute top-4 left-4 z-10 bg-brass text-white font-body font-semibold text-[11px] uppercase px-3 py-1">
                    FEATURED
                  </span>
                )}
                <img
                  src={resolveMediaUrl(product.image)}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-[400ms] group-hover:scale-105"
                  style={{
                    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>

              {/* Info */}
              <div className="p-5 md:p-6">
                <span className="font-body font-medium text-xs uppercase tracking-[0.06em] text-steel">
                  {categories.find(c => c.id === product.category)?.name || product.category}
                </span>
                <h3 className="font-display font-medium text-lg md:text-xl text-charcoal mt-1 leading-[1.2] tracking-[-0.01em]">
                  {product.name}
                </h3>
                <p className="font-body text-sm md:text-[15px] text-charcoal leading-[1.6] mt-2">
                  {product.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
