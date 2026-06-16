import { API_BASE_URL } from './api'

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''

export const resolveMediaUrl = (value?: string | null) => {
  if (!value) {
    return ''
  }

  try {
    const parsed = new URL(value)

    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/api/media/'))) {
      return `${API_BASE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.pathname.startsWith('/assets/')) {
      return browserOrigin ? `${browserOrigin}${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.pathname
    }

    return value
  } catch {
    // Non-absolute URLs fall through to the path handlers below.
  }

  if (value.startsWith('/uploads/') || value.startsWith('/api/media/')) {
    return `${API_BASE_URL}${value}`
  }

  if (value.startsWith('/assets/')) {
    return browserOrigin ? `${browserOrigin}${value}` : value
  }

  return value
}
