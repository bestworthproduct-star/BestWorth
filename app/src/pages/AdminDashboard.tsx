import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

// Modular Component Imports
import AdminLayout from '@/components/admin/AdminLayout'
import Overview from '@/components/admin/Overview'
import CatalogManager from '@/components/admin/CatalogManager'
import LeadershipStudio from '@/components/admin/LeadershipStudio'
import CommunicationCenter from '@/components/admin/CommunicationCenter'
import CMSStudio from '@/components/admin/CMSStudio'
import AccountSettings from '@/components/admin/AccountSettings'

// --- Interfaces ---
interface Product {
  _id: string
  name: string
  category: string
  description: string
  image: string
  featured: boolean
}

interface TeamMember {
  _id: string
  name: string
  role: string
  image: string
  bio?: string
  order: number
}

interface Inquiry {
  _id: string
  name: string
  email: string
  company: string
  message: string
  status: string
  createdAt: string
  reply?: {
    subject: string
    message: string
    sentAt: string
  }
}

// --- Main Component ---
export default function AdminDashboard() {
  // Navigation & Base State
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'team' | 'inquiries' | 'cms' | 'settings'>('dashboard')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Data State
  const [data, setData] = useState<{ products: Product[], inquiries: Inquiry[], team: TeamMember[] }>({ products: [], inquiries: [], team: [] })
  const [cmsContent, setCmsContent] = useState<any>({})
  const [stats, setStats] = useState({ products: 0, inquiries: 0, team: 0 })

  // Operation State
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [savingAccountSettings, setSavingAccountSettings] = useState(false)
  const [passwordChangeLocked, setPasswordChangeLocked] = useState(false)
  const [selectedInquiries, setSelectedInquiries] = useState<string[]>([])

  // Form States
  const [accountSettings, setAccountSettings] = useState({ username: '', notificationEmails: '', currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [productForm, setProductForm] = useState<Omit<Product, '_id'>>({ name: '', category: 'nails', description: '', image: '', featured: false })
  const [teamForm, setTeamForm] = useState<Omit<TeamMember, '_id'>>({ name: '', role: '', image: '', bio: '', order: 0 })

  // Modal States
  const [productModal, setProductModal] = useState<{ show: boolean, editId: string | null }>({ show: false, editId: null })
  const [teamModal, setTeamModal] = useState<{ show: boolean, editId: string | null }>({ show: false, editId: null })
  const [showCMSMobileWarning, setShowCMSMobileWarning] = useState(false)

  // --- Logic ---

  const redirectToServiceUnavailable = useCallback(() => {
    navigate('/service-unavailable?area=admin')
  }, [navigate])

  const fetchDashboardData = useCallback(async (token: string) => {
    try {
      const [pRes, iRes, tRes, cRes] = await Promise.all([
        fetch(apiUrl('/api/products'), { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(apiUrl('/api/inquiries'), { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(apiUrl('/api/team'), { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(apiUrl('/api/content'), { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      if ([pRes, iRes, tRes, cRes].some(r => r.status === 503)) return redirectToServiceUnavailable()
      if ([pRes, iRes, tRes, cRes].some(r => r.status === 401 || r.status === 403)) {
        localStorage.removeItem('adminToken')
        return navigate('/login')
      }

      const products = await pRes.json()
      const inquiries = await iRes.json()
      const team = await tRes.json()
      const content = await cRes.json()

      const profileRes = await fetch(apiUrl('/api/auth/me'), { headers: { 'Authorization': `Bearer ${token}` } })
      const profile = profileRes.ok ? await profileRes.json() : null

      setData({ products, inquiries, team })
      setCmsContent(content)
      if (profile?.username) {
        setAccountSettings(prev => ({
          ...prev,
          username: profile.username,
          notificationEmails: Array.isArray(profile.notificationEmails) ? profile.notificationEmails.join(', ') : ''
        }))
        setPasswordChangeLocked(Boolean(profile.passwordChangeLocked))
      }
      setStats({
        products: products.length,
        inquiries: inquiries.filter((i: any) => i.status === 'new').length,
        team: team.length
      })
      setLoading(false)
    } catch (err) {
      console.error(err)
      redirectToServiceUnavailable()
    }
  }, [navigate, redirectToServiceUnavailable])

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken')
      if (!token) return navigate('/login')

      try {
        const response = await fetch(apiUrl('/api/admin/check'), { headers: { 'Authorization': `Bearer ${token}` } })
        if (response.status === 503) return redirectToServiceUnavailable()
        if (response.ok) {
          setAuthorized(true)
          fetchDashboardData(token)
        } else {
          localStorage.removeItem('adminToken')
          navigate('/login')
        }
      } catch {
        redirectToServiceUnavailable()
      }
    }
    checkAuth()
  }, [navigate, fetchDashboardData, redirectToServiceUnavailable])

  // Real-time Sync
  const onDataChange = useCallback(() => {
    const token = localStorage.getItem('adminToken')
    if (token) fetchDashboardData(token)
  }, [fetchDashboardData])

  useSocket('product_change', onDataChange)
  useSocket('team_change', onDataChange)
  useSocket('inquiry_change', onDataChange)
  useSocket('content_change', onDataChange)

  // --- Handlers ---

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    navigate('/login')
  }

  const handleUpload = async (file: File, target: string, callback: (url: string) => void) => {
    const token = localStorage.getItem('adminToken')
    if (!token) return
    if (file.size > 10 * 1024 * 1024) return alert('Max 10MB allowed')

    setUploading(target)
    setUploadProgress(0)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', apiUrl('/api/upload'))
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => {
        const res = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) callback(res.url)
        else alert(res.message || 'Upload failed')
      }
      xhr.send(formData)
    } finally {
      setUploading(null)
      setUploadProgress(null)
    }
  }

  const handleUpdateContent = async (key: string, data: any) => {
    const token = localStorage.getItem('adminToken')
    try {
      const res = await fetch(apiUrl(`/api/content/${key}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      })
      if (res.ok) fetchDashboardData(token!)
    } catch (err) { console.error(err) }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('adminToken')
    const method = productModal.editId ? 'PUT' : 'POST'
    const url = productModal.editId ? apiUrl(`/api/products/${productModal.editId}`) : apiUrl('/api/products')

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(productForm)
      })
      if (res.ok) {
        setProductModal({ show: false, editId: null })
        setProductForm({ name: '', category: 'nails', description: '', image: '', featured: false })
        fetchDashboardData(token!)
      }
    } catch (err) { console.error(err) }
  }

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('adminToken')
    const method = teamModal.editId ? 'PUT' : 'POST'
    const url = teamModal.editId ? apiUrl(`/api/team/${teamModal.editId}`) : apiUrl('/api/team')

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(teamForm)
      })
      if (res.ok) {
        setTeamModal({ show: false, editId: null })
        setTeamForm({ name: '', role: '', image: '', bio: '', order: 0 })
        fetchDashboardData(token!)
      }
    } catch (err) { console.error(err) }
  }

  const handleUpdateInquiry = async (id: string, status: string) => {
    const token = localStorage.getItem('adminToken')
    await fetch(apiUrl(`/api/inquiries/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status })
    })
    fetchDashboardData(token!)
  }

  const handleSendReply = async (i: Inquiry, subject: string, message: string) => {
    const token = localStorage.getItem('adminToken')
    try {
      const res = await fetch(apiUrl('/api/inquiries/reply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ to: i.email, subject, message: message.replace(/\n/g, '<br>'), inquiryId: i._id })
      })
      if (res.ok) fetchDashboardData(token!)
    } catch (err) { console.error(err) }
  }

  if (!authorized) return null

  const renderContent = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-2 border-charcoal/5 border-t-brass rounded-full animate-spin mb-4" />
        <div className="text-charcoal/40 uppercase tracking-[0.3em] text-[10px] font-bold">Synchronizing Enterprise Engine...</div>
      </div>
    )

    switch (activeTab) {
      case 'dashboard': return <Overview stats={stats} />
      case 'products': return (
        <CatalogManager
          products={data.products}
          categories={cmsContent.categories || []}
          onAddProduct={() => {
            setProductForm({ name: '', category: cmsContent.categories?.[0]?.id || 'nails', description: '', image: '', featured: false })
            setProductModal({ show: true, editId: null })
          }}
          onEditProduct={(p) => {
            setProductForm({ name: p.name, category: p.category, description: p.description, image: p.image, featured: p.featured })
            setProductModal({ show: true, editId: p._id })
          }}
          onDeleteProduct={async (id) => {
            if (!window.confirm('Archive this specification?')) return
            const token = localStorage.getItem('adminToken')
            await fetch(apiUrl(`/api/products/${id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
            fetchDashboardData(token!)
          }}
          onSaveCategory={async (form, editId) => {
            const currentCategories = cmsContent.categories || []
            let updatedCategories
            if (editId) {
              updatedCategories = currentCategories.map((cat: any) => cat.id === editId ? { ...cat, name: form.name } : cat)
            } else {
              const newId = form.name.toLowerCase().replace(/\s+/g, '-')
              let finalId = newId
              let counter = 1
              while (currentCategories.find((c: any) => c.id === finalId)) {
                finalId = `${newId}-${counter}`
                counter++
              }
              updatedCategories = [...currentCategories, { id: finalId, name: form.name }]
            }
            await handleUpdateContent('categories', updatedCategories)
          }}
          onDeleteCategory={async (id) => {
            const productsInCat = data.products.filter(p => p.category === id)
            if (productsInCat.length > 0) return alert(`Cannot delete category. There are ${productsInCat.length} products assigned to it.`)
            if (!window.confirm('Purge this classification?')) return
            const updatedCategories = (cmsContent.categories || []).filter((cat: any) => cat.id !== id)
            await handleUpdateContent('categories', updatedCategories)
          }}
        />
      )
      case 'team': return (
        <LeadershipStudio
          team={data.team}
          settings={cmsContent.leadership || { autoSlide: true, delaySeconds: 15 }}
          onAdd={() => {
            setTeamForm({ name: '', role: '', image: '', bio: '', order: data.team.length })
            setTeamModal({ show: true, editId: null })
          }}
          onEdit={(m) => {
            setTeamForm({ name: m.name, role: m.role, image: m.image, bio: m.bio || '', order: m.order })
            setTeamModal({ show: true, editId: m._id })
          }}
          onDelete={async (id) => {
            if (!window.confirm('Remove from leadership board?')) return
            const token = localStorage.getItem('adminToken')
            await fetch(apiUrl(`/api/team/${id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
            fetchDashboardData(token!)
          }}
          onUpdateSettings={(s) => handleUpdateContent('leadership', s)}
        />
      )
      case 'inquiries': return (
        <CommunicationCenter
          inquiries={data.inquiries}
          cmsContent={cmsContent}
          selectedIds={selectedInquiries}
          onSelectToggle={(id) => setSelectedInquiries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          onSelectAll={(all) => setSelectedInquiries(all ? data.inquiries.map(i => i._id) : [])}
          onUpdateStatus={handleUpdateInquiry}
          onDelete={async (id) => {
            if (!window.confirm('Purge transmission thread?')) return
            const token = localStorage.getItem('adminToken')
            await fetch(apiUrl(`/api/inquiries/${id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
            fetchDashboardData(token!)
          }}
          onBulkDelete={async () => {
            if (!window.confirm(`Purge ${selectedInquiries.length} selected threads?`)) return
            const token = localStorage.getItem('adminToken')
            await fetch(apiUrl('/api/inquiries/bulk'), {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ ids: selectedInquiries })
            })
            setSelectedInquiries([])
            fetchDashboardData(token!)
          }}
          onReply={handleSendReply}
          onUpdateCMS={handleUpdateContent}
        />
      )
      case 'cms': return (
        <CMSStudio
          cmsContent={cmsContent}
          onUpdateContent={handleUpdateContent}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )
      case 'settings': return (
        <AccountSettings
          settings={accountSettings}
          saving={savingAccountSettings}
          passwordChangeLocked={passwordChangeLocked}
          onUpdateSettings={setAccountSettings}
          onSave={async (e) => {
            e.preventDefault()
            setSavingAccountSettings(true)
            const token = localStorage.getItem('adminToken')
            const res = await fetch(apiUrl('/api/auth/settings'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(accountSettings)
            })
            if (res.ok) alert('Administrative Access Updated')
            setSavingAccountSettings(false)
          }}
        />
      )
      default: return null
    }
  }

  return (
    <AdminLayout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        if (tab === 'cms' && window.innerWidth < 1024) {
          setShowCMSMobileWarning(true)
        } else {
          setActiveTab(tab)
        }
      }}
      handleLogout={handleLogout}
      stats={stats}
    >
      {renderContent()}

      {/* CMS Mobile Warning Modal */}
      {showCMSMobileWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white p-8 rounded-lg shadow-2xl border border-charcoal/10">
             <div className="mb-6">
                <h3 className="font-display text-xl text-charcoal font-bold tracking-tight mb-3">Optimize Experience</h3>
                <p className="text-[13px] text-charcoal/60 leading-relaxed">
                  The Site CMS Studio is a high-fidelity visual environment. For precise layout management and the best visual feedback, we recommend using a desktop or laptop device.
                </p>
             </div>
             <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setActiveTab('cms')
                    setShowCMSMobileWarning(false)
                  }}
                  className="w-full py-3 bg-charcoal text-white rounded-md text-[11px] font-bold uppercase tracking-widest hover:bg-black transition-all"
                >
                   Continue Anyway
                </button>
                <button
                  onClick={() => setShowCMSMobileWarning(false)}
                  className="w-full py-3 text-[11px] font-bold uppercase tracking-widest text-charcoal/40 hover:text-charcoal transition-all"
                >
                   Return to Dashboard
                </button>
             </div>
          </div>
        </div>
      )}

      {/* --- Global Modals --- */}

      {productModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" onClick={() => setProductModal({ show: false, editId: null })} />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-8 rounded-lg shadow-2xl border border-charcoal/10">
             <h3 className="font-display text-2xl text-charcoal mb-8 tracking-tight font-bold">
               {productModal.editId ? 'Edit Specification' : 'Initialize Product'}
             </h3>
             <form onSubmit={handleSaveProduct} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Product Name</label>
                    <input type="text" required className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Classification</label>
                    <select className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})}>
                      {cmsContent.categories?.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Digital Asset (Image)</label>
                  <div className="flex gap-2">
                    <input type="text" required className="flex-1 px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-xs font-mono focus:border-brass outline-none" value={productForm.image} onChange={e => setProductForm({...productForm, image: e.target.value})} />
                    <label className="px-6 py-3 bg-charcoal text-white rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brass transition-all">
                      {uploading === 'product' ? `${uploadProgress}%` : 'Upload'}
                      <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'product', url => setProductForm({...productForm, image: url}))} />
                    </label>
                  </div>
                  {productForm.image && (
                    <div className="mt-2 p-2 border border-charcoal/5 rounded-lg bg-warm-stone/20">
                      <p className="text-[8px] font-bold text-charcoal/30 uppercase mb-2">Live Preview</p>
                      <img src={resolveMediaUrl(productForm.image)} className="h-24 w-auto object-contain rounded border border-white" alt="Preview"/>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Technical Summary</label>
                  <textarea required rows={4} className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none resize-none" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} />
                </div>
                <div className="flex items-center gap-3 p-4 bg-brass/5 border border-brass/10 rounded-lg">
                  <input type="checkbox" id="featured" className="w-4 h-4 accent-brass" checked={productForm.featured} onChange={e => setProductForm({...productForm, featured: e.target.checked})} />
                  <label htmlFor="featured" className="text-[10px] font-bold uppercase tracking-widest text-brass cursor-pointer">Promote to Featured Showcase</label>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <button type="button" onClick={() => setProductModal({ show: false, editId: null })} className="px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-charcoal/40 hover:text-charcoal transition-all">Cancel</button>
                  <button type="submit" className="px-10 py-3 bg-charcoal text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brass transition-all shadow-xl">
                    Commit Asset
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {teamModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" onClick={() => setTeamModal({ show: false, editId: null })} />
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white p-8 rounded-lg shadow-2xl border border-charcoal/10">
             <h3 className="font-display text-2xl text-charcoal mb-8 tracking-tight font-bold">
               {teamModal.editId ? 'Modify Profile' : 'Register Executive'}
             </h3>
             <form onSubmit={handleSaveTeam} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Full Name</label>
                  <input type="text" required className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Corporate Role</label>
                  <input type="text" required className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none" value={teamForm.role} onChange={e => setTeamForm({...teamForm, role: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Display Order</label>
                  <input type="number" className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none" value={teamForm.order} onChange={e => setTeamForm({...teamForm, order: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Portrait Asset</label>
                  <div className="flex gap-2">
                    <input type="text" required className="flex-1 px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-xs font-mono focus:border-brass outline-none" value={teamForm.image} onChange={e => setTeamForm({...teamForm, image: e.target.value})} />
                    <label className="px-6 py-3 bg-charcoal text-white rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brass transition-all">
                      {uploading === 'team' ? `${uploadProgress}%` : 'Upload'}
                      <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'team', url => setTeamForm({...teamForm, image: url}))} />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40">Executive Biography</label>
                  <textarea rows={4} className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-lg text-sm focus:border-brass outline-none resize-none" value={teamForm.bio} onChange={e => setTeamForm({...teamForm, bio: e.target.value})} />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <button type="button" onClick={() => setTeamModal({ show: false, editId: null })} className="px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-charcoal/40 hover:text-charcoal transition-all">Cancel</button>
                  <button type="submit" className="px-10 py-3 bg-charcoal text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brass transition-all shadow-xl">
                    Save Profile
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}
