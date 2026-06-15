# Technical Specification — Bestworth Products Limited

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.0.0 | UI framework |
| react-dom | ^19.0.0 | React DOM renderer |
| react-router-dom | ^7.0.0 | Client-side routing |
| vite | ^6.0.0 | Build tool and dev server |
| @vitejs/plugin-react | ^4.0.0 | Vite React plugin |
| tailwindcss | ^4.0.0 | Utility-first CSS framework |
| @tailwindcss/vite | ^4.0.0 | Tailwind Vite integration |
| gsap | ^3.12.0 | Animation engine (ScrollTrigger, SplitText) |
| @gsap/react | ^2.1.0 | GSAP React hooks (useGSAP) |
| lenis | ^1.1.0 | Smooth scroll with inertia |

No shadcn/ui components are used — the design specifies entirely custom, non-standard UI elements.

---

## Component Inventory

### Layout

| Component | Source | Reuse | Notes |
|-----------|--------|-------|-------|
| Navigation | Custom | Once | Desktop sidebar (240px fixed left) + mobile top bar. Collapses at <768px. Contains logo, nav links, social icons, copyright. |
| Footer | Custom | Once | Dark surface footer with wordmark, social links, nav links, legal text. |
| ScrollReveal | Custom | Reused | Wrapper component for scroll-triggered entrance animations. Props: direction, distance, delay, duration, stagger. |
| TextReveal | Custom | Reused | Word-split heading animation using GSAP SplitText. Receives a heading element, splits into words, animates with ScrollTrigger. |

### Sections

| Component | Source | Notes |
|-----------|--------|-------|
| GrainCanvas | Custom | WebGL film-grain sweep canvas. Fixed position, z-index 0, runs its own RAF loop. Must be outside Lenis scroll container. |
| HeroSection | Custom | Full-height hero with video background, gradient overlay, text content, scroll indicator. |
| AboutSection | Custom | Two-column asymmetric layout with parallax image and text content. |
| ValuesSection | Custom | Three-column value cards grid on cream background. |
| ProductsSection | Custom | Product grid with filter tabs. Most complex section — manages filter state and GSAP layout transitions. |
| ManagementSection | Custom | Dark section with 3-column team card grid. Portrait images with grayscale→color hover. |
| ContactSection | Custom | Two-column: form (left) + info/map (right). |

### Hooks

| Hook | Purpose |
|------|---------|
| useLenis | Initializes Lenis instance, connects to GSAP ticker, wires ScrollTrigger update forwarding. Returns lenis instance. |

---

## Animation Implementation

| Animation | Library | Approach | Complexity |
|-----------|---------|----------|------------|
| Grain sweep canvas | WebGL (raw) | Custom fragment shader on fullscreen quad. RAF-driven time uniform. Resize listener for viewport. Visibility-change pause. | **High** 🔒 |
| Smooth scrolling | Lenis + GSAP | Lenis instance connected to GSAP ticker via `gsap.ticker.add`. ScrollTrigger.update forwarded on every Lenis scroll event. | **Medium** |
| Text word-reveal | GSAP + SplitText | SplitText splits heading into words. Each word wrapped in overflow:hidden container. GSAP fromTo with yPercent, stagger, ScrollTrigger. | **Medium** |
| Scroll reveal (default) | GSAP ScrollTrigger | Reusable ScrollReveal wrapper. fromTo opacity/y with ScrollTrigger start at "top 78%". | **Low** |
| Hero entrance sequence | GSAP timeline | Sequenced timeline: label fade → headline word-reveal → subtitle/CTA fade. Starts 0.3s after page load. | **Medium** |
| Scroll indicator bounce | CSS keyframes | Pure CSS translateY oscillation, infinite, 2s. No JS needed. | **Low** |
| About image parallax | GSAP ScrollTrigger | ScrollTrigger with scrub:true drives translateY at 0.8x scroll speed. | **Low** |
| Value cards stagger entrance | GSAP ScrollTrigger | fromTo with stagger 0.15s per card. | **Low** |
| Product filter + layout transition | GSAP | On filter click: non-matching cards animate to opacity:0/scale:0.95, then hidden. Matching cards reflow positions. Could use GSAP Flip for position transitions or simple opacity toggle with CSS grid auto-placement. | **High** 🔒 |
| Product cards stagger entrance | GSAP ScrollTrigger | Standard scroll reveal with stagger 0.08s. | **Low** |
| Product card image hover | CSS transition | scale(1.05) on image with overflow:hidden container. Pure CSS, no JS. | **Low** |
| Management cards stagger entrance | GSAP ScrollTrigger | fromTo with stagger 0.15s on dark background. | **Low** |
| Team portrait grayscale→color | CSS transition | filter: grayscale(100%) → grayscale(0%) on hover, 0.6s transition. | **Low** |
| Contact columns entrance | GSAP ScrollTrigger | Left column from left, right column from right, 0.15s delay offset. | **Low** |
| Footer fade entrance | GSAP ScrollTrigger | Simple opacity/y fade at trigger "top 90%". | **Low** |
| Nav sidebar backdrop blur | CSS transition | Backdrop-filter: blur(8px) toggled via class after 100px scroll. CSS transition on the filter property. | **Low** |
| Mobile menu overlay | GSAP timeline | Opacity + y animation with stagger on nav links. Timeline plays on open, reverses on close. | **Medium** |

---

## State & Logic Plan

### 1. Grain Canvas RAF Lifecycle

The WebGL canvas runs its own `requestAnimationFrame` loop outside React's render cycle. It must:
- Read from a ref for the time base (not React state)
- Pause on `document.visibilitychange` (hidden tab = cancel RAF, visible = restart)
- Resize on window resize via direct DOM mutation (not state)
- Component unmount cancels the RAF loop and cleans up the WebGL context

This is a fully imperative, non-React-managed element. The component should expose nothing — it self-initializes on mount and self-cleans on unmount.

### 2. Lenis ↔ React Bridge

Lenis must be instantiated once at the app root and shared with:
- Navigation (for scroll-to-section calls)
- GrainCanvas (no dependency — it's fixed)
- All ScrollTrigger-based animations (via the ticker integration)

The `useLenis` hook should:
1. Create the Lenis instance in a useEffect
2. Register `gsap.ticker.add((time) => lenis.raf(time * 1000))`
3. Register `lenis.on('scroll', ScrollTrigger.update)`
4. Set `gsap.ticker.lagSmoothing(0)`
5. Return the instance for scroll-to navigation
6. Cleanup all connections on unmount

The Lenis instance should be stored in a ref (not state) to avoid re-renders.

### 3. Product Filter State

ProductsSection manages local filter state (`activeFilter: 'all' | 'nails' | 'screws' | 'bolts' | 'building'`).

The filter transition requires GSAP-driven animation (not just CSS display toggling):
1. Capture current card positions before DOM change
2. Update React state to new filter
3. After React re-render, animate cards from captured positions to new positions (GSAP Flip or manual position tween)
4. Non-matching cards fade out first, then are removed from layout
5. Matching cards animate into their new grid positions

This requires a ref to track the grid container and a callback-based approach (not declarative re-render alone). GSAP's Flip plugin is the cleanest approach: `Flip.getState()` before state change, `Flip.from()` after.

### 4. Navigation Scroll Tracking

The sidebar active link indicator needs scroll-based detection of which section is in view. Use ScrollTrigger with section triggers, or IntersectionObserver with section refs, to update the active nav item. Store active section in state (this is lightweight enough for state).

---

## Other Key Decisions

### Raw WebGL over Three.js

The grain canvas is a single fullscreen quad with one simple fragment shader. Three.js would add ~150KB for functionality not needed here. Raw WebGL2D context with a single triangle strip is sufficient and lighter.

### GSAP SplitText over manual word splitting

SplitText handles word splitting, overflow:hidden wrapping, and cleanup automatically. Manual splitting with `textContent.split(' ')` would require recreating the DOM structure, handling whitespace, and cleaning up on unmount. SplitText is the correct tool for production-grade text reveal animations.

### No shadcn/ui

Every UI element in this design has custom styling with specific industrial aesthetics (sharp corners, custom hover effects, non-standard borders). No shadcn component would save time here — all components are custom-built with Tailwind.

### Routing

Single-page layout with anchor links (/#about, /#products, etc.) managed by Lenis `scrollTo()`. No multi-page routing needed. react-router-dom is included in case future pages are added but the initial build uses hash-based smooth scroll navigation.
