export type NewsMediaType = 'news' | 'video'
export type NewsMediaStatus = 'draft' | 'published'

export interface NewsMediaPost {
  _id: string
  title: string
  slug: string
  type: NewsMediaType
  excerpt: string
  body: string
  coverImage: string
  videoUrl: string
  videoDuration: string
  featured: boolean
  status: NewsMediaStatus
  publishedAt: string | null
  author: string
  seoTitle: string
  seoDescription: string
  createdAt: string
  updatedAt: string
}

export interface NewsMediaResponse {
  items: NewsMediaPost[]
  pagination: { page: number; limit: number; total: number; pages: number }
}
