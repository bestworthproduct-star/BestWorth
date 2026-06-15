const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const isDev = import.meta.env.DEV

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (isDev ? 'http://localhost:5000' : browserOrigin) ||
  'http://localhost:5000'

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (isDev ? 'http://localhost:5000' : API_BASE_URL)

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`
