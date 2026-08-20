import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NewsMediaPageHeader() {
  return (
    <header className="border-b border-[#102B4C]/12 bg-white text-[#102B4C]">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="text-[12px] font-medium uppercase tracking-[0.16em]">Bestworth</Link>
        <Link to="/#news-media" className="inline-flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.16em] text-[#102B4C]/48 transition hover:text-[#102B4C]"><ArrowLeft size={13}/> Company website</Link>
      </div>
    </header>
  )
}
