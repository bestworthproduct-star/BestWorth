const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  browserOrigin

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  API_BASE_URL

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`
