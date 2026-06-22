import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '@/lib/api'
import { resolveMediaUrl } from '@/lib/media'

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

interface ValueItem {
  title: string
  description: string
  icon: string
}

interface FooterSocialLink {
  label: string
  url: string
}

const HERO_IDLE_HIDE_FALLBACK_SECONDS = 25

export default function AdminDashboard() {
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'team' | 'inquiries' | 'cms' | 'settings'>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [stats, setStats] = useState({ products: 0, inquiries: 0, team: 0 })
  const [data, setData] = useState<{ products: Product[], inquiries: Inquiry[], team: TeamMember[] }>({ products: [], inquiries: [], team: [] })
  const [cmsContent, setCmsContent] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [savingTeam, setSavingTeam] = useState(false)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)
  const [accountSettings, setAccountSettings] = useState({ username: '', notificationEmails: '', currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [savingAccountSettings, setSavingAccountSettings] = useState(false)
  const [showAccountPasswords, setShowAccountPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false
  })
  
  // Modal states
  const [productModal, setProductModal] = useState<{ show: boolean, editId: string | null }>({ show: false, editId: null })
  const [teamModal, setTeamModal] = useState<{ show: boolean, editId: string | null }>({ show: false, editId: null })
  const [replyModal, setReplyModal] = useState<{ show: boolean, inquiry: Inquiry | null }>({ show: false, inquiry: null })
  const [categoryModal, setCategoryModal] = useState<{ show: boolean, editId: string | null }>({ show: false, editId: null })
  const [showTemplates, setShowTemplates] = useState(false)
  const [newTemplateModal, setNewTemplateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [selectedInquiries, setSelectedInquiries] = useState<string[]>([])
  const [sendingReply, setSendingReply] = useState(false)

  // Form states
  const [productForm, setProductForm] = useState<Omit<Product, '_id'>>({ name: '', category: 'nails', description: '', image: '', featured: false })
  const [teamForm, setTeamForm] = useState<Omit<TeamMember, '_id'>>({ name: '', role: '', image: '', bio: '', order: 0 })
  const [replyForm, setReplyForm] = useState({ subject: '', message: '' })
  const [categoryForm, setCategoryForm] = useState({ name: '', id: '' })

  const emptyTeamForm: Omit<TeamMember, '_id'> = { name: '', role: '', image: '', bio: '', order: 0 }

  const defaultValueItem: ValueItem = {
    title: '',
    description: '',
    icon: 'Shield'
  }

  const defaultFooterSocialLink: FooterSocialLink = {
    label: '',
    url: ''
  }

  const replyTemplates = [
    { name: 'Available', subject: 'Products Availability - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for reaching out to Bestworth Products Limited.\n\nWe are pleased to inform you that the items you inquired about are currently available in stock. We can fulfill your order immediately upon confirmation.\n\nPlease let us know your required quantities so we can provide a formal quotation.\n\nBest regards,\nSales Team` },
    { name: 'Not Available', subject: 'Product Status Update - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for your interest in our products.\n\nWe regret to inform you that the specific items requested are currently out of stock. We expect a new shipment within 2-3 weeks.\n\nWould you like us to notify you as soon as they are back in stock, or would you be interested in a similar alternative?\n\nBest regards,\nSales Team` },
    { name: 'Quotation Request', subject: 'Quotation Details - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for requesting a quotation from Bestworth Products Limited.\n\nTo provide you with the most accurate pricing and lead times, could you please provide the following details:\n- Specific product dimensions/grades\n- Required quantities\n- Preferred delivery timeline\n- Shipping destination (if applicable)\n\nOnce we have this information, we will generate a formal quote for your review.\n\nBest regards,\nEstimations Department` },
    { name: 'Partnership', subject: 'Business Partnership Inquiry - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for expressing interest in a business partnership with Bestworth Products Limited.\n\nWe are always looking to expand our network of corporate partners and distributors. I have forwarded your inquiry to our Business Development manager, who will review your company profile and reach out within 48 hours to discuss potential synergy.\n\nWe look forward to the possibility of working together.\n\nBest regards,\nExecutive Office` },
    { name: 'Technical Meeting', subject: 'Consultation Request - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for your inquiry regarding our industrial solutions.\n\nGiven the technical nature of your requirements, we believe a brief consultation would be the most efficient next step. Would you be available for a 15-minute call or video meeting later this week to discuss the specifications in detail?\n\nPlease let us know your availability, or feel free to suggest a time that works for you.\n\nBest regards,\nTechnical Support Team` },
    { name: 'Custom Spec', subject: 'Custom Manufacturing Inquiry - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for contacting us regarding custom manufacturing specifications.\n\nAt Bestworth, we pride ourselves on our ability to engineer custom solutions for unique builds. To help our production team assess the feasibility and cost, please share any technical drawings or detailed specifications you may have.\n\nWe will review these materials and provide an initial assessment of our manufacturing capability for this project.\n\nBest regards,\nProduction Engineering` },
    { name: 'Regret', subject: 'Regarding your inquiry - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for reaching out to us.\n\nAfter reviewing your request, we regret to inform you that we are currently unable to fulfill this specific requirement at this time due to [reason].\n\nWe appreciate your understanding and hope to be of service to you in the future for other industrial needs.\n\nBest regards,\nSales Team` },
    ...(cmsContent.email_templates || []).map((t: any) => ({
      name: t.name,
      subject: t.subject,
      message: (inquiry: Inquiry) => t.message.replace(/\{name\}/g, inquiry.name)
    }))
  ]

  const navigate = useNavigate()
  const navItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'products', label: 'Catalog' },
    { id: 'team', label: 'Leadership' },
    { id: 'inquiries', label: 'Communications' },
    { id: 'cms', label: 'Site CMS' },
    { id: 'settings', label: 'Settings' }
  ] as const

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

      const responses = [pRes, iRes, tRes, cRes]
      if (responses.some((response) => response.status === 503)) {
        redirectToServiceUnavailable()
        return
      }

      if (responses.some((response) => response.status === 401 || response.status === 403)) {
        localStorage.removeItem('adminToken')
        navigate('/login')
        return
      }

      const products = await pRes.json()
      const inquiries = await iRes.json()
      const team = await tRes.json()
      const content = await cRes.json()
      const profileRes = await fetch(apiUrl('/api/auth/me'), { headers: { 'Authorization': `Bearer ${token}` } })
      if (profileRes.status === 503) {
        redirectToServiceUnavailable()
        return
      }

      if (profileRes.status === 401 || profileRes.status === 403) {
        localStorage.removeItem('adminToken')
        navigate('/login')
        return
      }

      const profile = profileRes.ok ? await profileRes.json() : null

      setData({ products, inquiries, team })
      setCmsContent(content)
      if (profile?.username) {
        setAccountSettings((prev) => ({
          ...prev,
          username: profile.username,
          notificationEmails: Array.isArray(profile.notificationEmails) ? profile.notificationEmails.join(', ') : ''
        }))
      }
      setStats({
        products: products.length,
        inquiries: inquiries.filter((i: any) => i.status === 'new').length,
        team: team.length
      })
      setLoading(false)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      redirectToServiceUnavailable()
    }
  }, [navigate, redirectToServiceUnavailable])

  const onDataChange = useCallback(() => {
    const token = localStorage.getItem('adminToken')
    if (token) fetchDashboardData(token)
  }, [fetchDashboardData])

  useSocket('product_change', onDataChange)
  useSocket('team_change', onDataChange)
  useSocket('inquiry_change', onDataChange)
  useSocket('content_change', onDataChange)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        navigate('/login')
        return
      }

      try {
        const response = await fetch(apiUrl('/api/admin/check'), {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.status === 503) {
          redirectToServiceUnavailable()
          return
        }

        if (response.ok) {
          setAuthorized(true)
          fetchDashboardData(token)
        } else {
          localStorage.removeItem('adminToken')
          navigate('/login')
        }
      } catch (err) {
        redirectToServiceUnavailable()
      }
    }

    checkAuth()
  }, [navigate, fetchDashboardData, redirectToServiceUnavailable])

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' •')
  }

  const handleUpload = async (file: File, target: string, callback: (url: string) => void) => {
    const token = localStorage.getItem('adminToken')
    if (!token) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be 10MB or less')
      return
    }

    setUploading(target)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(apiUrl('/api/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        callback(result.url)
      } else {
        const result = await response.json().catch(() => null)
        alert(result?.message || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload error')
    } finally {
      setUploading(null)
    }
  }

  const handleUpdateInquiry = async (id: string, status: string) => {
    const token = localStorage.getItem('adminToken')
    try {
      await fetch(apiUrl(`/api/inquiries/${id}`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })
      fetchDashboardData(token!)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyModal.inquiry || sendingReply) return
    const token = localStorage.getItem('adminToken')
    setSendingReply(true)

    try {
      const response = await fetch(apiUrl('/api/inquiries/reply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          to: replyModal.inquiry.email,
          subject: replyForm.subject,
          message: replyForm.message.replace(/\n/g, '<br>'),
          inquiryId: replyModal.inquiry._id,
          cmsData: {
            contact: cmsContent.contact,
            footer: cmsContent.footer,
            branding: cmsContent.branding
          }
        })
      })
      const data = await response.json().catch(() => null)

      if (response.ok) {
        alert('Reply saved and email sent successfully')
        setReplyModal({ show: false, inquiry: null })
        setReplyForm({ subject: '', message: '' })
        fetchDashboardData(token!)
      } else {
        alert(data?.message || 'Failed to process reply')
      }
    } catch (err) {
      console.error('Error sending reply:', err)
      alert('Error sending reply')
    } finally {
      setSendingReply(false)
    }
  }

  const handleDeleteInquiry = async (id: string) => {
    if (!window.confirm('Delete this inquiry?')) return
    const token = localStorage.getItem('adminToken')
    try {
      await fetch(apiUrl(`/api/inquiries/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchDashboardData(token!)
      setSelectedInquiries(prev => prev.filter(item => item !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteBulk = async () => {
    if (!window.confirm(`Delete ${selectedInquiries.length} selected inquiries?`)) return
    const token = localStorage.getItem('adminToken')
    try {
      await fetch(apiUrl('/api/inquiries/bulk'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedInquiries })
      })
      fetchDashboardData(token!)
      setSelectedInquiries([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return
    const token = localStorage.getItem('adminToken')
    try {
      await fetch(apiUrl(`/api/products/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchDashboardData(token!)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('adminToken')
    const method = productModal.editId ? 'PUT' : 'POST'
    const url = productModal.editId 
      ? apiUrl(`/api/products/${productModal.editId}`)
      : apiUrl('/api/products')

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productForm)
      })
      if (res.ok) {
        setProductModal({ show: false, editId: null })
        setProductForm({ name: '', category: 'nails', description: '', image: '', featured: false })
        fetchDashboardData(token!)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingTeam || uploading === 'team') return

    const token = localStorage.getItem('adminToken')
    if (!token) return

    setSavingTeam(true)
    const method = teamModal.editId ? 'PUT' : 'POST'
    const url = teamModal.editId 
      ? apiUrl(`/api/team/${teamModal.editId}`)
      : apiUrl('/api/team')

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(teamForm)
      })
      if (res.ok) {
        setTeamModal({ show: false, editId: null })
        setTeamForm(emptyTeamForm)
        fetchDashboardData(token!)
        alert(teamModal.editId ? 'Executive updated successfully' : 'Executive created successfully')
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.message || 'Failed to save executive profile')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to save executive profile')
    } finally {
      setSavingTeam(false)
    }
  }

  const handleDeleteTeam = async (id: string) => {
    if (deletingTeamId) return
    if (!window.confirm('Remove this team member?')) return
    const token = localStorage.getItem('adminToken')
    if (!token) return

    setDeletingTeamId(id)
    try {
      const res = await fetch(apiUrl(`/api/team/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        fetchDashboardData(token!)
        alert('Executive removed successfully')
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.message || 'Failed to remove executive')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to remove executive')
    } finally {
      setDeletingTeamId(null)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    navigate('/login')
  }

  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingAccountSettings) return

    const token = localStorage.getItem('adminToken')
    if (!token) return

    setSavingAccountSettings(true)

    try {
      const response = await fetch(apiUrl('/api/auth/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(accountSettings)
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        alert(result?.message || 'Failed to update admin settings')
        return
      }

      if (result?.token) {
        localStorage.setItem('adminToken', result.token)
      }

      setAccountSettings({
        username: result?.user?.username || accountSettings.username,
        notificationEmails: Array.isArray(result?.user?.notificationEmails) ? result.user.notificationEmails.join(', ') : accountSettings.notificationEmails,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      })
      alert(result?.message || 'Admin settings updated successfully')
    } catch (error) {
      console.error('Failed to update admin settings:', error)
      alert('Failed to update admin settings')
    } finally {
      setSavingAccountSettings(false)
    }
  }

  const handleUpdateContent = async (key: string, data: any) => {
    const token = localStorage.getItem('adminToken')
    try {
      let payload = data
      if (key === 'hero') {
        const rawDelay = data?.idleHideDelaySeconds
        let idleHideDelaySeconds = HERO_IDLE_HIDE_FALLBACK_SECONDS

        if (rawDelay === null || rawDelay === 'never') {
          idleHideDelaySeconds = null as any
        } else {
          const parsedDelay = Number(rawDelay)
          idleHideDelaySeconds = Number.isFinite(parsedDelay)
            ? Math.max(15, parsedDelay)
            : HERO_IDLE_HIDE_FALLBACK_SECONDS
        }

        payload = {
          ...data,
          idleHideDelaySeconds
        }
      }

      const res = await fetch(apiUrl(`/api/content/${key}`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Content updated successfully')
        fetchDashboardData(token!)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    const currentCategories = cmsContent.categories || [
      { id: 'nails', name: 'Nails' },
      { id: 'screws', name: 'Screws' },
      { id: 'bolts', name: 'Bolts & Nuts' },
      { id: 'building', name: 'Building Materials' }
    ]

    let updatedCategories;
    if (categoryModal.editId) {
      updatedCategories = currentCategories.map((cat: any) =>
        cat.id === categoryModal.editId ? { ...cat, name: categoryForm.name } : cat
      )
    } else {
      const newId = categoryForm.name.toLowerCase().replace(/\s+/g, '-')
      // Ensure unique ID
      let finalId = newId
      let counter = 1
      while (currentCategories.find((c: any) => c.id === finalId)) {
        finalId = `${newId}-${counter}`
        counter++
      }
      updatedCategories = [...currentCategories, { id: finalId, name: categoryForm.name }]
    }

    try {
      await handleUpdateContent('categories', updatedCategories)
      setCategoryModal({ show: false, editId: null })
      setCategoryForm({ name: '', id: '' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    const productsInCat = data.products.filter(p => p.category === id)
    if (productsInCat.length > 0) {
      alert(`Cannot delete category. There are ${productsInCat.length} products assigned to it.`)
      return
    }

    if (!window.confirm('Delete this category?')) return
    const currentCategories = cmsContent.categories || []
    const updatedCategories = currentCategories.filter((cat: any) => cat.id !== id)

    try {
      await handleUpdateContent('categories', updatedCategories)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveCustomTemplate = async () => {
    if (!newTemplateName) return
    const currentTemplates = cmsContent.email_templates || []

    // Replace actual name with placeholder for future use
    const generalizedMessage = replyForm.message.replace(new RegExp(replyModal.inquiry?.name || '', 'g'), '{name}')

    const newTemplate = {
      name: newTemplateName,
      subject: replyForm.subject,
      message: generalizedMessage
    }

    try {
      await handleUpdateContent('email_templates', [...currentTemplates, newTemplate])
      setNewTemplateModal(false)
      setNewTemplateName('')
    } catch (err) {
      console.error('Error saving template:', err)
    }
  }

  const getValuesContent = (): ValueItem[] => {
    if (Array.isArray(cmsContent.values)) {
      return cmsContent.values
    }
    return []
  }

  const setValuesContent = (values: ValueItem[]) => {
    setCmsContent({ ...cmsContent, values })
  }

  const updateValueItem = (index: number, field: keyof ValueItem, value: string) => {
    const newValues = [...getValuesContent()]
    newValues[index] = { ...newValues[index], [field]: value }
    setValuesContent(newValues)
  }

  const addValueItem = () => {
    setValuesContent([...getValuesContent(), { ...defaultValueItem }])
  }

  const removeValueItem = (index: number) => {
    setValuesContent(getValuesContent().filter((_, currentIndex) => currentIndex !== index))
  }

  const moveValueItem = (index: number, direction: -1 | 1) => {
    const currentValues = [...getValuesContent()]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= currentValues.length) return

    ;[currentValues[index], currentValues[targetIndex]] = [currentValues[targetIndex], currentValues[index]]
    setValuesContent(currentValues)
  }

  const getExtraFooterSocials = (): FooterSocialLink[] => {
    if (Array.isArray(cmsContent.footer?.socials?.extra)) {
      return cmsContent.footer.socials.extra
    }
    return []
  }

  const setExtraFooterSocials = (extra: FooterSocialLink[]) => {
    setCmsContent({
      ...cmsContent,
      footer: {
        ...cmsContent.footer,
        socials: {
          ...cmsContent.footer?.socials,
          extra
        }
      }
    })
  }

  const addExtraFooterSocial = () => {
    setExtraFooterSocials([...getExtraFooterSocials(), { ...defaultFooterSocialLink }])
  }

  const updateExtraFooterSocial = (index: number, field: keyof FooterSocialLink, value: string) => {
    const nextItems = [...getExtraFooterSocials()]
    nextItems[index] = { ...nextItems[index], [field]: value }
    setExtraFooterSocials(nextItems)
  }

  const removeExtraFooterSocial = (index: number) => {
    setExtraFooterSocials(getExtraFooterSocials().filter((_, currentIndex) => currentIndex !== index))
  }

  if (!authorized) return null

  const renderContent = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-2 border-charcoal/5 border-t-brass rounded-full animate-spin mb-4"></div>
        <div className="text-charcoal/40 uppercase tracking-[0.3em] text-[10px] font-bold">Synchronizing Enterprise Data...</div>
      </div>
    )

    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
              {[
                { label: 'Total Catalog', value: stats.products, color: 'bg-white' },
                { label: 'New Inquiries', value: stats.inquiries, color: 'bg-white' },
                { label: 'Core Team', value: stats.team, color: 'bg-white' },
              ].map((stat, i) => (
                <div key={i} className={`${stat.color} border border-charcoal/5 p-10 shadow-sm transition-transform hover:-translate-y-1 duration-500`}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-charcoal/40 font-bold mb-6">{stat.label}</p>
                  <p className="text-5xl font-display text-charcoal font-medium">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-charcoal/40 font-bold mb-10">System Status</h3>
              <div className="flex items-center space-x-4 text-sm text-charcoal/80">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]"></div>
                <span className="font-medium">Enterprise Backend Online</span>
                <span className="text-charcoal/30 text-[10px] tracking-widest uppercase ml-auto">SSL SECURED</span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-charcoal/80 mt-6">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]"></div>
                <span className="font-medium">Database Synchronized (MongoDB Cluster)</span>
              </div>
            </div>
          </>
        )
      case 'products':
        const categories = cmsContent.categories || [
          { id: 'nails', name: 'Nails' },
          { id: 'screws', name: 'Screws' },
          { id: 'bolts', name: 'Bolts & Nuts' },
          { id: 'building', name: 'Building Materials' }
        ]
        return (
          <div className="space-y-12">
            <div className="bg-white border border-charcoal/5 shadow-sm overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-charcoal/5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.25em] text-charcoal/40 font-bold">Catalog Management</h3>
                  <p className="text-xs text-charcoal/40 mt-1 uppercase tracking-widest font-medium">Manage product inventory and featured items</p>
                </div>
                <button
                  onClick={() => {
                    setProductForm({ name: '', category: categories[0]?.id || 'nails', description: '', image: '', featured: false })
                    setProductModal({ show: true, editId: null })
                  }}
                  className="px-8 py-3 bg-charcoal text-white text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-brass transition-all duration-300 shadow-lg shadow-charcoal/10"
                >
                  + New Product
                </button>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="bg-charcoal/[0.02] text-[10px] uppercase tracking-widest text-charcoal/40 font-bold">
                    <th className="px-10 py-5">Product Details</th>
                    <th className="px-10 py-5">Category</th>
                    <th className="px-10 py-5">Featured</th>
                    <th className="px-10 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {data.products.map((p) => (
                    <tr key={p._id} className="text-sm text-charcoal/80 hover:bg-charcoal/[0.01] transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-warm-stone overflow-hidden mr-4 border border-charcoal/5">
                            <img src={resolveMediaUrl(p.image)} className="w-full h-full object-cover" alt="" />
                          </div>
                          <span className="font-medium text-charcoal">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 uppercase text-[10px] tracking-widest font-bold text-charcoal/60">
                        {categories.find((c: { id: string; name: string }) => c.id === p.category)?.name || p.category}
                      </td>
                      <td className="px-10 py-6">
                        {p.featured ? (
                          <span className="text-[9px] bg-brass/10 text-brass px-2 py-0.5 font-bold uppercase tracking-widest border border-brass/20">Featured</span>
                        ) : (
                          <span className="text-[9px] text-charcoal/30 uppercase tracking-widest">Standard</span>
                        )}
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button
                          onClick={() => {
                            setProductForm({ name: p.name, category: p.category, description: p.description, image: p.image, featured: p.featured })
                            setProductModal({ show: true, editId: p._id })
                          }}
                          className="text-[10px] uppercase tracking-widest font-bold text-charcoal/40 hover:text-charcoal mr-6 transition-colors"
                        >
                          Edit
                        </button>
                        <button onClick={() => handleDeleteProduct(p._id)} className="text-[10px] uppercase tracking-widest font-bold text-red-800/40 hover:text-red-800 transition-colors">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Category Management Section */}
            <div className="bg-white border border-charcoal/5 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-charcoal/5 flex justify-between items-center">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold">Category Management</h3>
                  <p className="text-xs text-charcoal/40 mt-1 uppercase tracking-widest font-medium">Define and organize product classifications</p>
                </div>
                <button
                  onClick={() => {
                    setCategoryForm({ name: '', id: '' })
                    setCategoryModal({ show: true, editId: null })
                  }}
                  className="px-6 py-2 border border-charcoal/10 text-[9px] uppercase tracking-widest font-bold hover:bg-charcoal hover:text-white transition-all"
                >
                  + Add Category
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 sm:p-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:p-10">
                {categories.map((cat: any) => (
                  <div key={cat.id} className="border border-charcoal/5 p-6 flex justify-between items-center group hover:border-brass transition-colors">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">ID: {cat.id}</p>
                      <h4 className="text-sm font-bold text-charcoal">{cat.name}</h4>
                    </div>
                    <div className="flex space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setCategoryForm({ name: cat.name, id: cat.id })
                          setCategoryModal({ show: true, editId: cat.id })
                        }}
                        className="text-[10px] text-charcoal/40 hover:text-charcoal font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-[10px] text-red-800/40 hover:text-red-800 font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      case 'inquiries':
        return (
          <div className="bg-white border border-charcoal/5 shadow-sm overflow-hidden relative">
             <div className="flex flex-col gap-4 border-b border-charcoal/5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-charcoal/40 font-bold">Customer Inquiries</h3>
                <p className="text-xs text-charcoal/40 mt-1 uppercase tracking-widest font-medium">Manage incoming business leads and messages</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="selectAll"
                    className="w-4 h-4 accent-brass cursor-pointer"
                    checked={data.inquiries.length > 0 && selectedInquiries.length === data.inquiries.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInquiries(data.inquiries.map(i => i._id))
                      } else {
                        setSelectedInquiries([])
                      }
                    }}
                  />
                  <label htmlFor="selectAll" className="text-[10px] uppercase tracking-widest font-bold text-charcoal/40 cursor-pointer">Select All</label>
                </div>
              </div>
            </div>

            {selectedInquiries.length > 0 && (
              <div className="bg-charcoal text-white px-10 py-4 flex justify-between items-center sticky top-0 z-20 animate-in fade-in slide-in-from-top-4 duration-500">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
                  {selectedInquiries.length} {selectedInquiries.length === 1 ? 'Inquiry' : 'Inquiries'} Selected for Batch Action
                </span>
                <button
                  onClick={handleDeleteBulk}
                  className="px-6 py-2 bg-red-900/40 border border-red-900/60 text-white text-[9px] tracking-widest uppercase font-bold hover:bg-red-800 transition-all"
                >
                  Confirm Batch Deletion
                </button>
              </div>
            )}

            <div className="divide-y divide-charcoal/5">
              {data.inquiries.length === 0 ? (
                <div className="p-20 text-center text-charcoal/20 uppercase tracking-widest text-xs font-bold">No Inquiries Found</div>
              ) : data.inquiries.map((i) => (
                <div key={i._id} className={`p-6 sm:p-8 lg:p-10 hover:bg-charcoal/[0.01] transition-colors flex flex-col gap-6 md:flex-row ${i.status === 'new' ? 'border-l-4 border-brass' : ''}`}>
                  <div className="pt-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-brass cursor-pointer"
                      checked={selectedInquiries.includes(i._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInquiries(prev => [...prev, i._id])
                        } else {
                          setSelectedInquiries(prev => prev.filter(id => id !== i._id))
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h4 className="font-display text-xl text-charcoal font-medium">{i.name}</h4>
                        <p className="text-xs text-charcoal/40 mt-1 uppercase tracking-widest font-bold">{i.company || 'Private Individual'} • {i.email}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-[9px] uppercase tracking-widest text-charcoal/30 font-bold">Received: {formatDate(i.createdAt)}</span>
                          {i.reply && (
                            <span className="text-[9px] uppercase tracking-widest text-brass font-bold flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-brass"></span>
                              Reply Sent: {formatDate(i.reply.sentAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">

                        <button
                          onClick={() => {
                            setReplyModal({ show: true, inquiry: i })
                            setReplyForm({
                              subject: i.reply?.subject || `Response to your inquiry - Bestworth Products Limited`,
                              message: i.reply?.message?.replace(/<br>/g, '\n') || `Dear ${i.name},\n\nThank you for reaching out...`
                            })
                          }}
                          className="px-4 py-1.5 bg-brass text-white text-[9px] tracking-widest uppercase font-bold hover:bg-charcoal transition-all"
                        >
                          {i.reply ? 'Edit Reply' : 'Reply'}
                        </button>
                        {i.status === 'new' && (
                          <button onClick={() => handleUpdateInquiry(i._id, 'read')} className="px-4 py-1.5 border border-charcoal/10 text-[9px] tracking-widest uppercase font-bold hover:bg-charcoal hover:text-white transition-all">Mark as Read</button>
                        )}
                        <button onClick={() => handleUpdateInquiry(i._id, 'archived')} className="px-4 py-1.5 border border-charcoal/10 text-[9px] tracking-widest uppercase font-bold hover:bg-red-900/10 hover:text-red-900 transition-all">Archive</button>
                        <button onClick={() => handleDeleteInquiry(i._id)} className="px-4 py-1.5 border border-red-900/10 text-[9px] tracking-widest uppercase font-bold text-red-900/40 hover:text-red-900 transition-all">Delete</button>
                      </div>
                    </div>
                    <p className="mt-6 text-charcoal/70 text-sm leading-relaxed max-w-3xl italic">"{i.message}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'team':
        return (
          <div className="space-y-8">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
               <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-charcoal/40 font-bold">Leadership Command</h3>
                <p className="text-xs text-charcoal/40 mt-1 uppercase tracking-widest font-medium">Manage executive board and team profiles</p>
              </div>
              <button 
                onClick={() => {
                  setTeamForm({ ...emptyTeamForm, order: data.team.length })
                  setTeamModal({ show: true, editId: null })
                }}
                className="px-8 py-3 bg-charcoal text-white text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-brass transition-all"
              >
                + Add Executive
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {data.team.map((m) => (
                <div key={m._id} className="bg-white border border-charcoal/5 p-8 shadow-sm group relative">
                  <div className="aspect-square bg-warm-stone mb-6 overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700 border border-charcoal/5">
                    <img src={resolveMediaUrl(m.image)} alt={m.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-[2s]" />
                  </div>
                  <h4 className="font-display text-lg text-charcoal font-medium">{m.name}</h4>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-brass font-bold mt-2">{m.role}</p>
                  
                  <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setTeamForm({ name: m.name, role: m.role, image: m.image, bio: m.bio || '', order: m.order ?? 0 })
                        setTeamModal({ show: true, editId: String(m._id) })
                      }}
                      className="w-8 h-8 bg-white border border-charcoal/5 flex items-center justify-center text-[10px] hover:text-brass transition-colors shadow-sm"
                    >
                      ✎
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTeam(m._id)
                      }}
                      disabled={deletingTeamId === m._id}
                      className="w-8 h-8 bg-white border border-charcoal/5 flex items-center justify-center text-[10px] hover:text-red-800 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'cms':
        return (
          <div className="space-y-12 pb-20">
            {/* Branding CMS */}
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold mb-8">Branding Assets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Corporate Logo URL (Publicly Hosted)</label>
                  <input
                    type="text"
                    value={cmsContent.branding?.logoUrl || ''}
                    onChange={(e) => setCmsContent({ ...cmsContent, branding: { ...cmsContent.branding, logoUrl: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-[11px] font-mono"
                    placeholder="https://your-domain.com/assets/logo.png"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="cursor-pointer">
                      <span className="text-[9px] uppercase tracking-tighter font-bold text-brass hover:underline">
                        {uploading === 'branding-logo' ? 'Uploading...' : '↑ Upload Logo'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleUpload(file, 'branding-logo', (uploadedUrl) => {
                              setCmsContent({
                                ...cmsContent,
                                branding: { ...cmsContent.branding, logoUrl: uploadedUrl }
                              })
                            })
                          }
                        }}
                      />
                    </label>
                    {cmsContent.branding?.logoUrl && (
                      <img
                        src={resolveMediaUrl(cmsContent.branding.logoUrl)}
                        alt="Logo preview"
                        className="h-14 w-auto border border-charcoal/10 bg-white object-contain px-3 py-2"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Favicon URL (Publicly Hosted)</label>
                  <input
                    type="text"
                    value={cmsContent.branding?.faviconUrl || ''}
                    onChange={(e) => setCmsContent({ ...cmsContent, branding: { ...cmsContent.branding, faviconUrl: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-[11px] font-mono"
                    placeholder="https://your-domain.com/favicon.png"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="cursor-pointer">
                      <span className="text-[9px] uppercase tracking-tighter font-bold text-brass hover:underline">
                        {uploading === 'branding-favicon' ? 'Uploading...' : '↑ Upload Favicon'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleUpload(file, 'branding-favicon', (uploadedUrl) => {
                              setCmsContent({
                                ...cmsContent,
                                branding: { ...cmsContent.branding, faviconUrl: uploadedUrl }
                              })
                            })
                          }
                        }}
                      />
                    </label>
                    {cmsContent.branding?.faviconUrl && (
                      <img
                        src={resolveMediaUrl(cmsContent.branding.faviconUrl)}
                        alt="Favicon preview"
                        className="h-14 w-14 border border-charcoal/10 bg-white object-contain p-2"
                      />
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[9px] text-charcoal/40 uppercase tracking-widest font-bold">Uploads are stored in the database and limited to 10MB per file.</p>
              <button onClick={() => handleUpdateContent('branding', cmsContent.branding)} className="mt-8 px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all">Update Branding</button>
            </div>

            {/* Hero CMS */}
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold mb-8">Hero Section</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Main Title</label>
                    <input 
                      type="text" 
                      value={cmsContent.hero?.title || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, title: e.target.value } })}
                      className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm font-display uppercase tracking-tight" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Subtitle</label>
                    <textarea 
                      value={cmsContent.hero?.subtitle || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, subtitle: e.target.value } })}
                      className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm min-h-[100px]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Hero Content Idle Fade</label>
                    <select
                      value={cmsContent.hero?.idleHideDelaySeconds === null ? 'never' : 'timed'}
                      onChange={(e) => {
                        const value = e.target.value
                        setCmsContent({
                          ...cmsContent,
                          hero: {
                            ...cmsContent.hero,
                            idleHideDelaySeconds: value === 'never'
                              ? null
                              : Math.max(15, Number(cmsContent.hero?.idleHideDelaySeconds) || HERO_IDLE_HIDE_FALLBACK_SECONDS)
                          }
                        })
                      }}
                      className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm"
                    >
                      <option value="timed">Fade after delay</option>
                      <option value="never">Off / Never fade</option>
                    </select>
                    <p className="mt-2 text-[10px] uppercase tracking-widest text-charcoal/35 font-bold">
                      Desktop only. Mobile and reduced-motion users keep the content visible.
                    </p>
                  </div>
                  {cmsContent.hero?.idleHideDelaySeconds !== null && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Idle Fade Delay (Seconds)</label>
                      <input
                        type="number"
                        min={15}
                        step={1}
                        value={cmsContent.hero?.idleHideDelaySeconds ?? HERO_IDLE_HIDE_FALLBACK_SECONDS}
                        onChange={(e) => setCmsContent({
                          ...cmsContent,
                          hero: {
                            ...cmsContent.hero,
                            idleHideDelaySeconds: Math.max(15, Number(e.target.value) || HERO_IDLE_HIDE_FALLBACK_SECONDS)
                          }
                        })}
                        className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm"
                      />
                      <p className="mt-2 text-[10px] uppercase tracking-widest text-charcoal/35 font-bold">
                        Minimum allowed delay is 15 seconds. Fallback is {HERO_IDLE_HIDE_FALLBACK_SECONDS} seconds.
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Button Text</label>
                    <input 
                      type="text" 
                      value={cmsContent.hero?.buttonText || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, buttonText: e.target.value } })}
                      className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm font-bold uppercase tracking-widest" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Background Videos</label>
                    <div className="space-y-3">
                      {(cmsContent.hero?.videoUrls || []).map((url: string, index: number) => (
                        <div key={index} className="flex flex-col gap-2 p-4 border border-charcoal/5 bg-charcoal/[0.02]">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={url} 
                              onChange={(e) => {
                                const newUrls = [...(cmsContent.hero?.videoUrls || [])]
                                newUrls[index] = e.target.value
                                setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, videoUrls: newUrls } })
                              }}
                              className="flex-1 px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                              placeholder="Video URL or Path"
                            />
                            <button 
                              onClick={() => {
                                const newUrls = (cmsContent.hero?.videoUrls || []).filter((_: any, i: number) => i !== index)
                                setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, videoUrls: newUrls } })
                              }}
                              className="px-4 bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex-1 cursor-pointer">
                              <span className="text-[9px] uppercase tracking-tighter font-bold text-brass hover:underline">
                                {uploading === `hero-video-${index}` ? 'Uploading...' : '↑ Upload Video File'}
                              </span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="video/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleUpload(file, `hero-video-${index}`, (uploadedUrl) => {
                                      const newUrls = [...(cmsContent.hero?.videoUrls || [])]
                                      newUrls[index] = uploadedUrl
                                      setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, videoUrls: newUrls } })
                                    })
                                  }
                                }}
                              />
                            </label>
                            {url && (
                              <span className="text-[9px] text-charcoal/30 truncate max-w-[200px]">
                                Current: {url.split('/').pop()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const newUrls = [...(cmsContent.hero?.videoUrls || []), '']
                          setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, videoUrls: newUrls } })
                        }}
                        className="w-full py-2 border-2 border-dashed border-charcoal/10 text-[10px] uppercase tracking-widest font-bold text-charcoal/40 hover:border-brass hover:text-brass transition-all"
                      >
                        + Add Video URL
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Establishment Date</label>
                    <input 
                      type="text" 
                      value={cmsContent.hero?.establishmentDate || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, hero: { ...cmsContent.hero, establishmentDate: e.target.value } })}
                      className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm uppercase tracking-widest" 
                    />
                  </div>
                </div>
              </div>
              <button onClick={() => handleUpdateContent('hero', cmsContent.hero)} className="mt-8 px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all">Update Hero Content</button>
            </div>

            {/* About CMS */}
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold mb-8">About Us Section</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Section Title</label>
                  <input 
                    type="text" 
                    value={cmsContent.about?.title || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, title: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm font-display uppercase tracking-tight" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Image URL</label>
                  <input 
                    type="text" 
                    value={cmsContent.about?.imageUrl || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, imageUrl: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="cursor-pointer">
                      <span className="text-[9px] uppercase tracking-tighter font-bold text-brass hover:underline">
                        {uploading === 'about-image' ? 'Uploading...' : '↑ Upload About Image'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleUpload(file, 'about-image', (uploadedUrl) => {
                              setCmsContent({
                                ...cmsContent,
                                about: { ...cmsContent.about, imageUrl: uploadedUrl }
                              })
                            })
                          }
                        }}
                      />
                    </label>
                    {cmsContent.about?.imageUrl && (
                      <img
                        src={resolveMediaUrl(cmsContent.about.imageUrl)}
                        alt="About preview"
                        className="h-20 w-32 border border-charcoal/10 bg-white object-cover"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Description Paragraphs</label>
                  <textarea 
                    value={(cmsContent.about?.description || []).join('\n\n')}
                    onChange={(e) => {
                      const paragraphs = e.target.value.split('\n\n').filter(p => p.trim() !== '')
                      setCmsContent({ ...cmsContent, about: { ...cmsContent.about, description: paragraphs } })
                    }}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm min-h-[200px]"
                    placeholder="Enter each paragraph separated by a blank line..."
                  />
                </div>
              </div>
              <button onClick={() => handleUpdateContent('about', cmsContent.about)} className="mt-8 px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all">Update About Content</button>
            </div>

            {/* Contact CMS */}
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold mb-8">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Physical Address</label>
                  <input 
                    type="text" 
                    value={cmsContent.contact?.address || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, address: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Phone Number</label>
                  <input 
                    type="text" 
                    value={cmsContent.contact?.phone || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, phone: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Email Address</label>
                  <input 
                    type="text" 
                    value={cmsContent.contact?.email || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, email: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Google Maps Embed URL</label>
                  <input 
                    type="text" 
                    value={cmsContent.contact?.mapUrl || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, mapUrl: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-[10px]" 
                  />
                </div>
              </div>
              <button onClick={() => handleUpdateContent('contact', cmsContent.contact)} className="mt-8 px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all">Update Contact Details</button>
            </div>

            {/* Values CMS */}
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold">Our Values</h3>
                  <p className="text-xs text-charcoal/40 mt-1 uppercase tracking-widest font-medium">Add, remove, and reorder public values</p>
                </div>
                <button
                  onClick={addValueItem}
                  className="px-6 py-3 bg-charcoal text-white text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-brass transition-all"
                >
                  + Add Value
                </button>
              </div>
              <div className="space-y-8">
                {getValuesContent().map((value: ValueItem, index: number) => (
                  <div key={index} className="p-6 border border-charcoal/5 bg-warm-stone/20 space-y-4">
                    <div className="flex justify-between items-center gap-4">
                      <p className="text-[10px] uppercase tracking-widest text-charcoal/40 font-bold">Value {index + 1}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => moveValueItem(index, -1)}
                          disabled={index === 0}
                          className="px-3 py-2 border border-charcoal/10 text-[10px] uppercase tracking-widest hover:border-brass disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveValueItem(index, 1)}
                          disabled={index === getValuesContent().length - 1}
                          className="px-3 py-2 border border-charcoal/10 text-[10px] uppercase tracking-widest hover:border-brass disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeValueItem(index)}
                          className="px-3 py-2 border border-red-200 text-[10px] uppercase tracking-widest text-red-700 hover:border-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">Title</label>
                        <input 
                          type="text" 
                          value={value.title} 
                          onChange={(e) => updateValueItem(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-charcoal/10 text-sm outline-none focus:border-brass"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">Icon (Shield, Target, Briefcase, HandHeart, Leaf)</label>
                        <input 
                          type="text" 
                          value={value.icon} 
                          onChange={(e) => updateValueItem(index, 'icon', e.target.value)}
                          className="w-full px-3 py-2 border border-charcoal/10 text-sm outline-none focus:border-brass"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">Description</label>
                      <textarea 
                        value={value.description} 
                        onChange={(e) => updateValueItem(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-charcoal/10 text-sm outline-none focus:border-brass min-h-[60px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => handleUpdateContent('values', getValuesContent())} className="mt-8 px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all">Update Values</button>
            </div>

            {/* Footer CMS */}
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold mb-8">Footer & Socials</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Copyright Text</label>
                  <input 
                    type="text" 
                    value={cmsContent.footer?.copyright || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, copyright: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Registration Number (e.g., RC: 1191234)</label>
                  <input 
                    type="text" 
                    value={cmsContent.footer?.registrationNumber || ''} 
                    onChange={(e) => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, registrationNumber: e.target.value } })}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm" 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Facebook URL</label>
                    <input 
                      type="text" 
                      value={cmsContent.footer?.socials?.facebook || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, socials: { ...cmsContent.footer.socials, facebook: e.target.value } } })}
                      className="w-full px-4 py-3 border border-charcoal/10 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">LinkedIn URL</label>
                    <input 
                      type="text" 
                      value={cmsContent.footer?.socials?.linkedin || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, socials: { ...cmsContent.footer.socials, linkedin: e.target.value } } })}
                      className="w-full px-4 py-3 border border-charcoal/10 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Instagram URL</label>
                    <input 
                      type="text" 
                      value={cmsContent.footer?.socials?.instagram || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, socials: { ...cmsContent.footer.socials, instagram: e.target.value } } })}
                      className="w-full px-4 py-3 border border-charcoal/10 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Twitter URL</label>
                    <input 
                      type="text" 
                      value={cmsContent.footer?.socials?.twitter || ''} 
                      onChange={(e) => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, socials: { ...cmsContent.footer.socials, twitter: e.target.value } } })}
                      className="w-full px-4 py-3 border border-charcoal/10 text-sm" 
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <div className="flex items-end justify-between gap-4 mb-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">Extra Social Handles</label>
                      <p className="text-[10px] uppercase tracking-widest text-charcoal/30 font-bold">
                        Add more social icons beyond the four default platforms.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addExtraFooterSocial}
                      className="px-5 py-2 border border-charcoal/10 text-[10px] uppercase tracking-widest font-bold hover:border-brass hover:text-brass transition-all"
                    >
                      + Add Handle
                    </button>
                  </div>

                  <div className="space-y-4">
                    {getExtraFooterSocials().map((item, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto] gap-3 items-end border border-charcoal/5 p-4 bg-warm-stone/20">
                        <div>
                          <label className="block text-[9px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">Platform Name</label>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateExtraFooterSocial(index, 'label', e.target.value)}
                            className="w-full px-3 py-2 border border-charcoal/10 text-sm outline-none focus:border-brass"
                            placeholder="tiktok / phone / whatsapp"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase tracking-widest text-charcoal/40 font-bold mb-1">Handle or URL</label>
                          <input
                            type="text"
                            value={item.url}
                            onChange={(e) => updateExtraFooterSocial(index, 'url', e.target.value)}
                            className="w-full px-3 py-2 border border-charcoal/10 text-sm outline-none focus:border-brass"
                            placeholder="@bestworth / +2348000000000 / https://..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExtraFooterSocial(index)}
                          className="px-4 py-2 border border-red-200 text-[10px] uppercase tracking-widest font-bold text-red-700 hover:border-red-400 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => handleUpdateContent('footer', cmsContent.footer)} className="mt-8 px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all">Update Footer Content</button>
            </div>
          </div>
        )
      case 'settings':
        return (
          <div className="max-w-3xl">
            <div className="bg-white border border-charcoal/5 p-10 shadow-sm">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-brass font-bold mb-2">Admin Settings</h3>
              <p className="text-xs text-charcoal/40 uppercase tracking-widest font-medium mb-8">
                Update the admin username and password. Password changes must always use a new password.
              </p>

              <form onSubmit={handleSaveAccountSettings} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Admin Username</label>
                  <input
                    type="text"
                    value={accountSettings.username}
                    onChange={(e) => setAccountSettings((prev) => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Company Notification Emails</label>
                  <textarea
                    value={accountSettings.notificationEmails}
                    onChange={(e) => setAccountSettings((prev) => ({ ...prev, notificationEmails: e.target.value }))}
                    className="w-full px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm min-h-[110px]"
                    placeholder="sales@company.com, admin@company.com"
                  />
                  <p className="mt-2 text-[10px] uppercase tracking-widest text-charcoal/35 font-bold">
                    Separate multiple emails with commas or new lines.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Current Password</label>
                  <div className="flex gap-2">
                    <input
                      type={showAccountPasswords.currentPassword ? 'text' : 'password'}
                      value={accountSettings.currentPassword}
                      onChange={(e) => setAccountSettings((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccountPasswords((prev) => ({ ...prev, currentPassword: !prev.currentPassword }))}
                      className="px-4 py-3 border border-charcoal/10 text-[10px] uppercase tracking-widest font-bold text-charcoal/50 hover:border-brass hover:text-brass transition-all"
                    >
                      {showAccountPasswords.currentPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">New Password</label>
                    <div className="flex gap-2">
                      <input
                        type={showAccountPasswords.newPassword ? 'text' : 'password'}
                        value={accountSettings.newPassword}
                        onChange={(e) => setAccountSettings((prev) => ({ ...prev, newPassword: e.target.value }))}
                        className="flex-1 px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm"
                        placeholder="Leave blank to keep current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountPasswords((prev) => ({ ...prev, newPassword: !prev.newPassword }))}
                        className="px-4 py-3 border border-charcoal/10 text-[10px] uppercase tracking-widest font-bold text-charcoal/50 hover:border-brass hover:text-brass transition-all"
                      >
                        {showAccountPasswords.newPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-charcoal/40 font-bold mb-2">Confirm New Password</label>
                    <div className="flex gap-2">
                      <input
                        type={showAccountPasswords.confirmNewPassword ? 'text' : 'password'}
                        value={accountSettings.confirmNewPassword}
                        onChange={(e) => setAccountSettings((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                        className="flex-1 px-4 py-3 border border-charcoal/10 focus:border-brass outline-none transition-colors text-sm"
                        placeholder="Repeat the new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountPasswords((prev) => ({ ...prev, confirmNewPassword: !prev.confirmNewPassword }))}
                        className="px-4 py-3 border border-charcoal/10 text-[10px] uppercase tracking-widest font-bold text-charcoal/50 hover:border-brass hover:text-brass transition-all"
                      >
                        {showAccountPasswords.confirmNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={savingAccountSettings}
                    className="px-10 py-3 bg-charcoal text-white text-[10px] tracking-widest uppercase font-bold hover:bg-brass transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingAccountSettings ? 'Saving...' : 'Update Admin Access'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F8F5]">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-charcoal/5 bg-white/95 px-4 py-4 backdrop-blur lg:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brass">Bestworth</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-charcoal/45">
            {navItems.find((item) => item.id === activeTab)?.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="rounded-full border border-charcoal/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-charcoal"
        >
          {mobileNavOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/55" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-[320px] bg-charcoal shadow-2xl">
            <div className="border-b border-white/5 p-6">
              <h2 className="font-display text-white text-2xl tracking-tighter">BESTWORTH</h2>
              <p className="mt-2 text-[9px] text-brass tracking-[0.4em] font-bold opacity-80 uppercase">Enterprise Portal</p>
            </div>
            <nav className="space-y-2 p-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setMobileNavOpen(false)
                  }}
                  className={`w-full rounded-xl px-4 py-4 text-left text-[10px] uppercase tracking-[0.3em] font-bold transition-all ${
                    activeTab === item.id
                      ? 'border border-brass/30 bg-white/5 text-white'
                      : 'text-steel hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 p-4">
              <button
                onClick={handleLogout}
                className="w-full rounded-xl border border-white/10 py-4 text-[10px] uppercase tracking-[0.28em] font-bold text-white"
              >
                Terminate Session
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-[280px] bg-charcoal fixed h-full z-50 shadow-2xl lg:flex lg:flex-col">
        <div className="p-10 border-b border-white/5">
          <h2 className="font-display text-white text-2xl tracking-tighter">BESTWORTH</h2>
          <p className="text-[9px] text-brass tracking-[0.4em] mt-2 font-bold opacity-80 uppercase">Enterprise Portal</p>
        </div>
        
        <nav className="flex-1 p-8 space-y-3">
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-bold transition-all ${
                activeTab === item.id 
                  ? 'bg-white/5 text-white border-l-2 border-brass' 
                  : 'text-steel hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full py-4 border border-white/5 text-white text-[9px] uppercase tracking-[0.3em] font-bold hover:bg-red-900/20 hover:border-red-900/40 transition-all"
          >
            Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:ml-[280px] lg:p-16">
        <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between lg:mb-16">
          <div>
            <span className="text-[10px] uppercase tracking-[0.4em] text-brass font-bold mb-4 block">Central Command</span>
            <h1 className="font-display text-4xl text-charcoal tracking-tight font-medium capitalize sm:text-5xl lg:text-6xl">
              {activeTab === 'inquiries'
                ? 'Communications'
                : activeTab === 'team'
                  ? 'Leadership'
                  : activeTab === 'cms'
                    ? 'CMS'
                    : activeTab === 'settings'
                      ? 'Settings'
                      : activeTab}
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] text-charcoal/40 font-bold uppercase tracking-widest">Connected as Admin</p>
            <p className="text-xs text-charcoal/60 mt-1 font-medium">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </header>

        {renderContent()}
      </main>

      {/* Product Modal */}
      {productModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 lg:p-6">
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" onClick={() => setProductModal({ show: false, editId: null })}></div>
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-charcoal/10 bg-white p-5 shadow-2xl sm:p-8 lg:p-12">
            <h3 className="font-display text-3xl text-charcoal mb-10 tracking-tight">
              {productModal.editId ? 'Edit Product Specification' : 'Initialize New Product'}
            </h3>
            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Product Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                    value={productForm.name}
                    onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Category</label>
                  <select 
                    className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    {(cmsContent.categories || [
                      { id: 'nails', name: 'Nails' },
                      { id: 'screws', name: 'Screws' },
                      { id: 'bolts', name: 'Bolts & Nuts' },
                      { id: 'building', name: 'Building Materials' }
                    ]).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Image URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" required
                    placeholder="/assets/product-..."
                    className="flex-1 bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors font-mono"
                    value={productForm.image}
                    onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                  />
                  <label className="px-4 py-3 bg-brass text-white text-[10px] uppercase font-bold cursor-pointer hover:bg-charcoal transition-colors flex items-center justify-center min-w-[100px]">
                    {uploading === 'product' ? '...' : 'Upload'}
                    <input 
                      type="file" className="hidden" accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(file, 'product', url => setProductForm({ ...productForm, image: url }))
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Technical Description</label>
                <textarea 
                  required rows={4}
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors resize-none"
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-3">
                <input 
                  type="checkbox" id="featured"
                  className="w-4 h-4 accent-brass"
                  checked={productForm.featured}
                  onChange={e => setProductForm({ ...productForm, featured: e.target.checked })}
                />
                <label htmlFor="featured" className="text-[10px] uppercase tracking-widest font-bold text-charcoal/60 cursor-pointer">Set as Featured Asset</label>
              </div>
              <div className="pt-8 flex justify-end space-x-4">
                <button 
                  type="button"
                  onClick={() => setProductModal({ show: false, editId: null })}
                  className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-charcoal/40 hover:text-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-10 py-3 bg-charcoal text-white text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brass transition-all"
                >
                  {productModal.editId ? 'Commit Changes' : 'Finalize Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {teamModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 lg:p-6">
          <div
            className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm"
            onClick={() => {
              setTeamModal({ show: false, editId: null })
              setTeamForm(emptyTeamForm)
            }}
          ></div>
          <div className="relative bg-white w-full max-w-xl max-h-[92vh] border border-charcoal/10 shadow-2xl overflow-hidden">
            <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-8 md:p-12">
              <h3 className="font-display text-3xl text-charcoal mb-10 tracking-tight">
                {teamModal.editId ? 'Update Executive Profile' : 'Register New Executive'}
              </h3>
              <form onSubmit={handleSaveTeam} className="space-y-6">
                <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Full Name</label>
                <input 
                  type="text" required
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                  value={teamForm.name}
                  onChange={e => setTeamForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                </div>
                <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Corporate Role</label>
                <input 
                  type="text" required
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                  value={teamForm.role}
                  onChange={e => setTeamForm((prev) => ({ ...prev, role: e.target.value }))}
                />
                </div>
                <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Display Order</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                  value={teamForm.order}
                  onChange={e => setTeamForm((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))}
                />
                </div>
                <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Portrait Image URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" required
                    className="flex-1 bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors font-mono"
                    value={teamForm.image}
                    onChange={e => setTeamForm((prev) => ({ ...prev, image: e.target.value }))}
                  />
                  <label className="px-4 py-3 bg-brass text-white text-[10px] uppercase font-bold cursor-pointer hover:bg-charcoal transition-colors flex items-center justify-center min-w-[100px]">
                    {uploading === 'team' ? '...' : 'Upload'}
                    <input 
                      type="file" className="hidden" accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleUpload(file, 'team', (url) => {
                            setTeamForm((prev) => ({ ...prev, image: url }))
                          })
                        }
                      }}
                    />
                  </label>
                </div>
                {teamForm.image && (
                  <div className="mt-3 border border-charcoal/10 bg-warm-stone/20 p-3 inline-block">
                    <img
                      src={resolveMediaUrl(teamForm.image)}
                      alt="Executive preview"
                      className="h-28 w-24 object-cover"
                    />
                  </div>
                )}
                </div>
                <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Executive Biography</label>
                <textarea
                  rows={5}
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors resize-none"
                  value={teamForm.bio}
                  onChange={e => setTeamForm((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Optional: Professional history and role details..."
                />
                </div>
                <div className="pt-8 flex justify-end space-x-4 sticky bottom-0 bg-white">
                <button 
                  type="button"
                  onClick={() => {
                    setTeamModal({ show: false, editId: null })
                    setTeamForm(emptyTeamForm)
                  }}
                  className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-charcoal/40 hover:text-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingTeam || uploading === 'team'}
                  className="px-10 py-3 bg-charcoal text-white text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brass transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingTeam ? 'Saving...' : teamModal.editId ? 'Update Profile' : 'Finalize Profile'}
                </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {replyModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 lg:p-6">
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" onClick={() => setReplyModal({ show: false, inquiry: null })}></div>
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-charcoal/10 bg-white p-5 shadow-2xl sm:p-8 lg:p-12">
            <h3 className="font-display text-3xl text-charcoal mb-4 tracking-tight">Communications Center</h3>
            <p className="text-[10px] uppercase tracking-widest text-brass font-bold mb-8">Direct Response Management</p>
            
            <div className="mb-8 p-6 bg-charcoal/[0.03] border border-charcoal/5">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] uppercase tracking-widest text-charcoal/40 font-bold">Original Inquiry from {replyModal.inquiry?.name}</p>
                <span className="text-[9px] uppercase tracking-widest text-charcoal/30 font-bold">{formatDate(replyModal.inquiry?.createdAt || '')}</span>
              </div>
              <p className="text-sm italic text-charcoal/60">"{replyModal.inquiry?.message}"</p>
              {replyModal.inquiry?.reply && (
                <div className="mt-4 pt-4 border-t border-charcoal/5">
                  <p className="text-[9px] uppercase tracking-widest text-brass font-bold">Last Reply Transmitted: {formatDate(replyModal.inquiry.reply.sentAt)}</p>
                </div>
              )}
            </div>

            <div className="mb-8">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-full flex justify-between items-center py-3 border-b border-charcoal/10 text-[10px] uppercase tracking-[0.2em] font-bold text-charcoal hover:text-brass transition-all"
              >
                <span>Quick Response Templates</span>
                <span className={`transform transition-transform duration-300 ${showTemplates ? 'rotate-180' : ''}`}>▼</span>
              </button>

              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showTemplates ? 'max-h-[400px] mt-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-wrap gap-3">
                  {replyTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (replyModal.inquiry) {
                          setReplyForm({
                            subject: template.subject,
                            message: template.message(replyModal.inquiry)
                          })
                        }
                      }}
                      className="px-4 py-2 border border-charcoal/10 text-[9px] uppercase tracking-widest font-bold hover:border-brass hover:text-brass transition-all"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleSendReply} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Recipient</label>
                  <input 
                    type="text" disabled
                    className="w-full bg-warm-stone/10 border border-charcoal/10 px-4 py-3 text-sm font-mono opacity-60"
                    value={replyModal.inquiry?.email || ''}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Company Reference</label>
                  <input 
                    type="text" disabled
                    className="w-full bg-warm-stone/10 border border-charcoal/10 px-4 py-3 text-sm font-mono opacity-60"
                    value={replyModal.inquiry?.company || 'N/A'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Subject Line</label>
                <input 
                  type="text" required
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                  value={replyForm.subject}
                  onChange={e => setReplyForm({ ...replyForm, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Custom Message</label>
                <textarea 
                  required
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors min-h-[180px]"
                  value={replyForm.message}
                  onChange={e => setReplyForm({ ...replyForm, message: e.target.value })}
                />
              </div>
              <div className="pt-8 flex justify-between items-center">
                <button 
                  type="button"
                  onClick={() => setNewTemplateModal(true)}
                  className="text-[9px] uppercase tracking-widest font-bold text-brass hover:underline"
                >
                  + Save Current as New Template
                </button>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setReplyModal({ show: false, inquiry: null })}
                    className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-charcoal/40 hover:text-charcoal transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="px-10 py-3 bg-brass text-white text-[10px] uppercase tracking-widest font-bold hover:bg-charcoal transition-all shadow-lg shadow-brass/10 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sendingReply ? 'SENDING...' : 'Transmit Official Reply'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Modal */}
      {categoryModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 lg:p-6">
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" onClick={() => setCategoryModal({ show: false, editId: null })}></div>
          <div className="relative w-full max-w-md border border-charcoal/10 bg-white p-5 shadow-2xl sm:p-8 lg:p-12">
            <h3 className="font-display text-2xl text-charcoal mb-8 tracking-tight">
              {categoryModal.editId ? 'Edit Category' : 'New Classification'}
            </h3>
            <form onSubmit={handleSaveCategory} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Category Name</label>
                <input
                  type="text" required
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>
              {categoryModal.editId && (
                <div className="p-4 bg-brass/5 border border-brass/10">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-brass">Warning</p>
                  <p className="text-[10px] text-charcoal/60 mt-1">Renaming this category will update the display name across the site. The underlying identifier will remain the same for data integrity.</p>
                </div>
              )}
              <div className="pt-4 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setCategoryModal({ show: false, editId: null })}
                  className="px-6 py-2 text-[10px] uppercase tracking-widest font-bold text-charcoal/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 bg-charcoal text-white text-[10px] uppercase tracking-widest font-bold hover:bg-brass transition-all"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Template Modal */}
      {newTemplateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 lg:p-6">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setNewTemplateModal(false)}></div>
          <div className="relative w-full max-w-md border border-charcoal/10 bg-white p-5 shadow-2xl sm:p-8 lg:p-10">
            <h4 className="font-display text-xl text-charcoal mb-6 tracking-tight font-medium">Create New Template</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest font-bold text-charcoal/40">Template Name</label>
                <input
                  type="text"
                  className="w-full bg-warm-stone/30 border border-charcoal/10 px-4 py-3 text-sm focus:border-brass outline-none transition-colors"
                  placeholder="e.g., Delivery Schedule"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                />
              </div>
              <p className="text-[9px] text-charcoal/40 leading-relaxed italic">
                * This will save the current subject and message. The customer's name will be automatically replaced with a placeholder for future use.
              </p>
              <div className="pt-6 flex justify-end space-x-4">
                <button
                  onClick={() => setNewTemplateModal(false)}
                  className="text-[10px] uppercase tracking-widest font-bold text-charcoal/40"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCustomTemplate}
                  className="px-6 py-2 bg-charcoal text-white text-[10px] uppercase tracking-widest font-bold hover:bg-brass transition-all"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
