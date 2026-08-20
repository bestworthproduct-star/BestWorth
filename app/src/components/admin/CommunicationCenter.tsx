import { useState } from 'react'
import { Search, Trash2, Archive, CheckCircle, Clock, Send, Reply, X } from 'lucide-react'

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

interface CommunicationCenterProps {
  canManage: boolean
  inquiries: Inquiry[]
  cmsContent: any
  onUpdateStatus: (id: string, status: string) => void
  onDelete: (id: string) => void
  onReply: (inquiry: Inquiry, subject: string, message: string) => Promise<void>
  selectedIds: string[]
  onSelectToggle: (id: string) => void
  onSelectAll: (all: boolean) => void
  onBulkDelete: () => void
  onUpdateCMS: (key: string, data: any) => Promise<void>
}

export default function CommunicationCenter({
  canManage,
  inquiries,
  cmsContent,
  onUpdateStatus,
  onDelete,
  onReply,
  selectedIds,
  onSelectToggle,
  onSelectAll,
  onBulkDelete,
  onUpdateCMS
}: CommunicationCenterProps) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [replyModal, setReplyModal] = useState<{ show: boolean, inquiry: Inquiry | null }>({ show: false, inquiry: null })
  const [replyForm, setReplyForm] = useState({ subject: '', message: '' })
  const [showTemplates, setShowTemplates] = useState(false)
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  const baseTemplates = [
    { name: 'Available', subject: 'Products Availability - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for reaching out to Bestworth Products Limited.\n\nWe are pleased to inform you that the items you inquired about are currently available in stock. We can fulfill your order immediately upon confirmation.\n\nPlease let us know your required quantities so we can provide a formal quotation.\n\nBest regards,\nSales Team` },
    { name: 'Not Available', subject: 'Product Status Update - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for your interest in our products.\n\nWe regret to inform you that the specific items requested are currently out of stock. We expect a new shipment within 2-3 weeks.\n\nWould you like us to notify you as soon as they are back in stock, or would you be interested in a similar alternative?\n\nBest regards,\nSales Team` },
    { name: 'Quotation Request', subject: 'Quotation Details - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for requesting a quotation from Bestworth Products Limited.\n\nTo provide you with the most accurate pricing and lead times, could you please provide the following details:\n- Specific product dimensions/grades\n- Required quantities\n- Preferred delivery timeline\n- Shipping destination (if applicable)\n\nOnce we have this information, we will generate a formal quote for your review.\n\nBest regards,\nEstimations Department` },
    { name: 'Partnership', subject: 'Business Partnership Inquiry - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for expressing interest in a business partnership with Bestworth Products Limited.\n\nWe are always looking to expand our network of corporate partners and distributors. I have forwarded your inquiry to our Business Development manager, who will review your company profile and reach out within 48 hours to discuss potential synergy.\n\nWe look forward to the possibility of working together.\n\nBest regards,\nExecutive Office` },
    { name: 'Technical Meeting', subject: 'Consultation Request - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for your inquiry regarding our industrial solutions.\n\nGiven the technical nature of your requirements, we believe a brief consultation would be the most efficient next step. Would you be available for a 15-minute call or video meeting later this week to discuss the specifications in detail?\n\nPlease let us know your availability, or feel free to suggest a time that works for you.\n\nBest regards,\nTechnical Support Team` },
    { name: 'Custom Spec', subject: 'Custom Manufacturing Inquiry - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for contacting us regarding custom manufacturing specifications.\n\nAt Bestworth, we pride ourselves on our ability to engineer custom solutions for unique builds. To help our production team assess the feasibility and cost, please share any technical drawings or detailed specifications you may have.\n\nWe will review these materials and provide an initial assessment of our manufacturing capability for this project.\n\nBest regards,\nProduction Engineering` },
    { name: 'Regret', subject: 'Regarding your inquiry - Bestworth Products Limited', message: (inquiry: Inquiry) => `Dear ${inquiry.name},\n\nThank you for reaching out to us.\n\nAfter reviewing your request, we regret to inform you that we are currently unable to fulfill this specific requirement at this time due to [reason].\n\nWe appreciate your understanding and hope to be of service to you in the future for other industrial needs.\n\nBest regards,\nSales Team` },
  ]

  const customTemplates = (cmsContent.email_templates || []).map((t: any) => ({
    name: t.name,
    subject: t.subject,
    message: (inquiry: Inquiry) => t.message.replace(/\{name\}/g, inquiry.name)
  }))

  const allTemplates = [...baseTemplates, ...customTemplates]

  const filtered = inquiries.filter(i => {
    const matchesFilter = filter === 'all' || i.status === filter
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
                         i.company?.toLowerCase().includes(search.toLowerCase()) ||
                         i.email.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleOpenReply = (i: Inquiry) => {
    setReplyModal({ show: true, inquiry: i })
    setReplyForm({
      subject: i.reply?.subject || `Response to Inquiry - Bestworth Products Limited`,
      message: i.reply?.message?.replace(/<br>/g, '\n') || `Dear ${i.name},\n\n`
    })
  }

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName || !replyModal.inquiry) return
    const generalizedMessage = replyForm.message.replace(new RegExp(replyModal.inquiry.name, 'g'), '{name}')
    const newTemplate = { name: newTemplateName, subject: replyForm.subject, message: generalizedMessage }
    const updatedTemplates = [...(cmsContent.email_templates || []), newTemplate]
    await onUpdateCMS('email_templates', updatedTemplates)
    setShowNewTemplateModal(false)
    setNewTemplateName('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-warm-stone/20 p-4 rounded-md border border-charcoal/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" size={14} />
          <input type="text" placeholder="Search inquiries..." className="w-full pl-9 pr-4 py-2 bg-white border border-charcoal/10 rounded-md text-[13px] outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-warm-stone/50 p-1 rounded-lg border border-charcoal/5 h-10">
          {['all', 'new', 'read', 'archived'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-brass shadow-sm' : 'text-charcoal/40 hover:text-charcoal'}`}>{f}</button>
          ))}
        </div>
        {canManage && selectedIds.length > 0 && <button onClick={onBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">Purge {selectedIds.length}</button>}
      </div>

      <div className="bg-white border border-charcoal/10 rounded-md shadow-sm overflow-hidden">
        <div className="p-4 border-b border-charcoal/5 bg-warm-stone/20 flex items-center gap-4">
          {canManage && <input type="checkbox" className="w-3.5 h-3.5 rounded accent-brass" checked={inquiries.length > 0 && selectedIds.length === inquiries.length} onChange={(e) => onSelectAll(e.target.checked)} />}
          <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal/40">Select Threads</span>
        </div>

        <div className="divide-y divide-charcoal/5 text-[13px]">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-charcoal/20 uppercase tracking-[0.2em] text-[10px] font-bold">Inbox Empty</div>
          ) : filtered.map((i) => (
            <div key={i._id} className={`p-5 flex gap-4 transition-colors hover:bg-warm-stone/5 ${i.status === 'new' ? 'bg-brass/[0.01] border-l-2 border-l-brass' : ''}`}>
              {canManage && <input type="checkbox" className="w-3.5 h-3.5 rounded accent-brass mt-1" checked={selectedIds.includes(i._id)} onChange={() => onSelectToggle(i._id)} />}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-charcoal flex items-center gap-2">{i.name} {i.status === 'new' && <span className="bg-brass text-white px-1.5 py-0.5 rounded text-[8px] font-bold">NEW</span>}</h4>
                    <p className="text-[11px] text-charcoal/40 font-bold uppercase mt-0.5">{i.email} • {i.company || 'Private'}</p>
                  </div>
                  {canManage && <div className="flex gap-1">
                    <button onClick={() => handleOpenReply(i)} className="p-2 hover:text-brass" title="Respond"><Reply size={14}/></button>
                    {i.status === 'new' && <button onClick={() => onUpdateStatus(i._id, 'read')} className="p-2 hover:text-green-600" title="Acknowledge"><CheckCircle size={14}/></button>}
                    <button onClick={() => onUpdateStatus(i._id, 'archived')} className="p-2 hover:text-charcoal" title="Archive"><Archive size={14}/></button>
                    <button onClick={() => onDelete(i._id)} className="p-2 hover:text-red-600" title="Delete"><Trash2 size={14}/></button>
                  </div>}
                </div>
                <p className="text-charcoal/70 line-clamp-2">"{i.message}"</p>
                <div className="mt-3 flex items-center gap-4 text-[10px] text-charcoal/30 font-bold uppercase tracking-widest">
                   <span className="flex items-center gap-1"><Clock size={12}/> {new Date(i.createdAt).toLocaleDateString()}</span>
                   {i.reply && <span className="flex items-center gap-1 text-green-600/60"><Send size={12}/> Responded</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {canManage && replyModal.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white p-8 rounded-md shadow-2xl border border-charcoal/10 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-charcoal tracking-tight">Response Studio</h3>
                <button onClick={() => setReplyModal({ show: false, inquiry: null })}><X size={20} className="text-charcoal/20"/></button>
             </div>
             <div className="p-4 bg-warm-stone/20 rounded border border-charcoal/5 mb-6 italic text-charcoal/60 text-sm">"{replyModal.inquiry?.message}"</div>

             <div className="mb-6">
                <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center justify-between w-full text-[10px] font-bold uppercase text-brass border-b border-charcoal/5 pb-2"><span>Templates</span><span>{showTemplates ? '−' : '+'}</span></button>
                {showTemplates && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {allTemplates.map((t, idx) => (
                      <button key={idx} onClick={() => replyModal.inquiry && setReplyForm({ subject: t.subject, message: t.message(replyModal.inquiry) })} className="px-3 py-2 bg-warm-stone border border-charcoal/5 rounded text-[9px] font-bold uppercase hover:border-brass transition-all text-left">{t.name}</button>
                    ))}
                  </div>
                )}
             </div>

             <form onSubmit={async (e) => { e.preventDefault(); if (replyModal.inquiry) await onReply(replyModal.inquiry, replyForm.subject, replyForm.message); setReplyModal({show:false, inquiry:null}); }} className="space-y-4">
                <input type="text" required placeholder="Subject" className="w-full px-4 py-3 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none" value={replyForm.subject} onChange={e => setReplyForm({...replyForm, subject: e.target.value})} />
                <textarea required rows={6} placeholder="Message" className="w-full px-4 py-3 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none resize-none" value={replyForm.message} onChange={e => setReplyForm({...replyForm, message: e.target.value})} />
                <div className="flex justify-between items-center pt-4 border-t border-charcoal/5">
                   <button type="button" onClick={() => setShowNewTemplateModal(true)} className="text-[10px] font-bold uppercase text-brass hover:underline">+ Save Template</button>
                   <button type="submit" className="px-8 py-3 bg-charcoal text-white rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-black">Transmit</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {showNewTemplateModal && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setShowNewTemplateModal(false)} />
          <div className="relative w-full max-w-md bg-white p-8 rounded-lg shadow-2xl border border-charcoal/10">
            <h4 className="font-display font-bold text-lg text-charcoal mb-4">Archive Template</h4>
            <input type="text" className="w-full px-4 py-3 bg-warm-stone/30 border border-charcoal/10 rounded-md text-[13px] outline-none" placeholder="Template Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
            <div className="flex justify-end gap-3 pt-6"><button onClick={() => setShowNewTemplateModal(false)} className="px-6 py-2 text-[9px] font-bold uppercase tracking-widest text-charcoal/40">Discard</button><button onClick={handleSaveAsTemplate} className="px-8 py-2 bg-charcoal text-white rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-lg">Save</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
