import { Link } from 'react-router-dom'
import { openCookiePreferences } from '@/lib/cookie-consent'

export default function NewsMediaPageFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#102B4C] text-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-8 text-[9px] uppercase tracking-[0.14em] text-white/38 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span>© {new Date().getFullYear()} Bestworth Products Limited</span>
        <div className="flex flex-wrap gap-5"><Link to="/privacy-policy" className="hover:text-white">Privacy Policy</Link><Link to="/cookie-policy" className="hover:text-white">Cookie Policy</Link><button type="button" onClick={openCookiePreferences} className="hover:text-white">Cookie Settings</button><Link to="/" className="hover:text-white">Company website</Link></div>
      </div>
    </footer>
  )
}
