import { useState, useEffect } from 'react'
import { LayoutDashboard, Package, Users, MessageSquare, FileEdit, Settings, LogOut, Menu, X, ChevronRight, ArrowLeft, type LucideIcon } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'
import { apiUrl } from '@/lib/api'

interface AdminLayoutProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: any) => void
  handleLogout: () => void
  stats: { products: number; inquiries: number; team: number }
}

interface NavItem {
  id: 'dashboard' | 'products' | 'team' | 'inquiries' | 'cms' | 'settings'
  label: string
  icon: LucideIcon
}

export const navItems: readonly NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Catalog', icon: Package },
  { id: 'team', label: 'Leadership', icon: Users },
  { id: 'inquiries', label: 'Inquiries', icon: MessageSquare },
  { id: 'cms', label: 'Site CMS', icon: FileEdit },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const

export default function AdminLayout({ children, activeTab, setActiveTab, handleLogout }: AdminLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [branding, setBranding] = useState<any>(null)
  const isCMS = activeTab === 'cms'

  useEffect(() => {
    fetch(apiUrl('/api/content/branding'))
      .then(res => res.json())
      .then(data => setBranding(data))
      .catch(err => console.error('Failed to load branding:', err))
  }, [])

  const logoUrl = resolveMediaUrl(branding?.logoUrl)

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-charcoal/5 bg-white px-4 py-3 lg:hidden h-14">
        {logoUrl ? (
          <img src={logoUrl} className="h-7 object-contain" alt="Bestworth" />
        ) : (
          <span className="text-[11px] font-bold tracking-widest text-charcoal/80 uppercase">Bestworth Admin</span>
        )}
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="p-2 text-charcoal/60">
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[70%] bg-white shadow-xl flex flex-col border-r border-charcoal/10">
            <div className="p-6 border-b border-charcoal/5">
              {logoUrl ? (
                <img src={logoUrl} className="h-8 object-contain" alt="Bestworth" />
              ) : (
                <span className="text-[11px] font-bold tracking-widest text-charcoal/80 uppercase">Bestworth</span>
              )}
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                  className={`w-full rounded-md px-4 py-3 text-left text-[12px] font-medium transition-all flex items-center gap-3 ${
                    activeTab === item.id ? 'bg-charcoal text-white' : 'text-charcoal/60 hover:bg-warm-stone'
                  }`}
                >
                  <item.icon size={16} /> {item.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-charcoal/5">
              <button onClick={handleLogout} className="w-full py-3 text-[11px] font-medium text-red-600 flex items-center justify-center gap-2"><LogOut size={14}/> Logout</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar (Collapsible in CMS) */}
        {!isCMS && (
          <aside className="hidden lg:flex flex-col w-[240px] border-r border-charcoal/5 h-screen sticky top-0 bg-warm-stone/20">
            <div className="p-8 border-b border-charcoal/5">
              {logoUrl ? (
                <img src={logoUrl} className="h-10 w-auto object-contain" alt="Bestworth" />
              ) : (
                <span className="text-[10px] font-bold tracking-[0.2em] text-charcoal/40 uppercase">Enterprise Portal</span>
              )}
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-4 py-2.5 text-[13px] font-medium transition-all rounded-md flex items-center gap-3 group ${
                    activeTab === item.id ? 'bg-white text-charcoal shadow-sm border border-charcoal/10' : 'text-charcoal/50 hover:text-charcoal hover:bg-warm-stone'
                  }`}
                >
                  <item.icon size={16} className={activeTab === item.id ? 'text-brass' : 'text-charcoal/20 group-hover:text-charcoal/40'} />
                  <span className="flex-1">{item.label}</span>
                  {activeTab === item.id && <ChevronRight size={12} className="text-charcoal/20" />}
                </button>
              ))}
            </nav>
            <div className="p-6 border-t border-charcoal/5">
              <button onClick={handleLogout} className="text-[12px] font-medium text-charcoal/40 hover:text-red-600 flex items-center gap-2 transition-colors"><LogOut size={14}/> Sign Out</button>
            </div>
          </aside>
        )}

        {/* Main Area */}
        <main className="flex-1 min-w-0">
          {isCMS && (
            <header className="h-14 border-b border-charcoal/10 flex items-center justify-between px-6 sticky top-0 bg-white z-40">
               <div className="flex items-center gap-6">
                  <span className="text-[11px] font-bold tracking-widest text-charcoal uppercase">Site CMS Studio</span>
                  <div className="h-4 w-px bg-charcoal/10" />
               </div>
               <button
                  onClick={() => setActiveTab('dashboard')}
                  className="flex items-center gap-2 text-[12px] font-medium text-charcoal/50 hover:text-charcoal transition-colors px-3 py-1.5 rounded-md hover:bg-warm-stone"
               >
                  <ArrowLeft size={14} /> Back to Admin
               </button>
            </header>
          )}

          <div className={`${isCMS ? 'w-full' : 'max-w-[1200px] mx-auto p-8'}`}>
            {!isCMS && (
              <header className="mb-10">
                <h1 className="text-2xl font-semibold text-charcoal tracking-tight">
                  {navItems.find(i => i.id === activeTab)?.label}
                </h1>
                <p className="text-[13px] text-charcoal/40 mt-1">Manage your platform resources and configuration.</p>
              </header>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
