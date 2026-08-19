import { useState, useEffect, useRef } from 'react'
import { Save, Monitor, Smartphone, RefreshCw, Trash2, ChevronUp, ChevronDown, Eye, Video } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

interface CMSStudioProps {
  cmsContent: any
  onUpdateContent: (key: string, data: any) => Promise<void>
  onUpload: (file: File, target: string, callback: (url: string) => void) => void
  uploading: string | null
}

export default function CMSStudio({ cmsContent, onUpdateContent, onUpload, uploading }: CMSStudioProps) {
  const [activeSection, setActiveSection] = useState('hero')
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [localData, setLocalData] = useState<any>(cmsContent)
  const [isSaving, setIsSaving] = useState(false)
  const [previewScale, setPreviewScale] = useState(0.4)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setLocalData(cmsContent)
  }, [cmsContent])

  // Scale calculations for the "Bird's Eye View"
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      const targetWidth = viewMode === 'desktop' ? 1280 : 375

      // Calculate scale to fit the target width into 45% of the container (max 240px for mobile)
      const availableWidth = viewMode === 'desktop' ? (containerWidth - 48) : Math.min(containerWidth * 0.45, 240)
      const scale = availableWidth / targetWidth
      setPreviewScale(Math.min(scale, 1))
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [viewMode])

  const syncIframe = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'CMS_UPDATE',
        section: activeSection,
        data: localData
      }, '*')
    }
  }

  // Sync data to iframe when data or section changes
  useEffect(() => {
    syncIframe()
    // Secondary sync for load stability
    const timer = setTimeout(syncIframe, 500)
    return () => clearTimeout(timer)
  }, [localData, activeSection])

  const handleLocalChange = (key: string, field: string, value: any) => {
    setLocalData((prev: any) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }))
  }

  const handleSave = async (key: string) => {
    setIsSaving(true)
    await onUpdateContent(key, localData[key])
    setIsSaving(false)
  }

  const handleFileUpload = (key: string, field: string, file: File, index?: number) => {
    const target = index !== undefined ? `${key}-${field}-${index}` : `${key}-${field}`
    onUpload(file, target, (url: string) => {
      if (index !== undefined) {
        const list = [...(localData[key][field] || [])]
        list[index] = url
        handleLocalChange(key, field, list)
      } else {
        handleLocalChange(key, field, url)
      }
    })
  }

  // Value Item Helpers
  const updateValueItem = (index: number, field: string, value: string) => {
    const list = [...(localData.values || [])]
    list[index] = { ...list[index], [field]: value }
    setLocalData((prev: any) => ({ ...prev, values: list }))
  }

  const addValueItem = () => {
    const list = [...(localData.values || []), { title: '', description: '', icon: 'Shield' }]
    setLocalData((prev: any) => ({ ...prev, values: list }))
  }

  const moveValueItem = (index: number, dir: number) => {
    const list = [...(localData.values || [])]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    [list[index], list[target]] = [list[target], list[index]]
    setLocalData((prev: any) => ({ ...prev, values: list }))
  }

  // Footer Social Helpers
  const getExtraFooterSocials = () => Array.isArray(localData.footer?.socials?.extra) ? localData.footer.socials.extra : []

  const updateExtraFooterSocial = (index: number, field: string, value: string) => {
    const nextExtra = [...getExtraFooterSocials()]
    nextExtra[index] = { ...nextExtra[index], [field]: value }
    setLocalData((prev: any) => ({
      ...prev,
      footer: { ...prev.footer, socials: { ...prev.footer?.socials, extra: nextExtra } }
    }))
  }

  const addExtraFooterSocial = () => {
    const nextExtra = [...getExtraFooterSocials(), { label: '', url: '' }]
    setLocalData((prev: any) => ({
      ...prev,
      footer: { ...prev.footer, socials: { ...prev.footer?.socials, extra: nextExtra } }
    }))
  }

  const sections = [
    { id: 'branding', label: 'Branding' },
    { id: 'hero', label: 'Hero' },
    { id: 'about', label: 'About Us' },
    { id: 'values', label: 'Values' },
    { id: 'contact', label: 'Contact' },
    { id: 'footer', label: 'Footer' },
    { id: 'legal', label: 'Policies' },
  ]

  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-charcoal/40 mb-2'
  const inputClass = 'w-full px-3 py-2.5 bg-white border border-charcoal/10 rounded-md text-[13px] focus:border-charcoal focus:ring-0 transition-all outline-none placeholder:text-charcoal/20'

  const renderEditor = () => {
    switch (activeSection) {
      case 'branding':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className={labelClass}>Corporate Logo</label>
              <div className="p-4 border border-charcoal/5 rounded bg-white shadow-sm">
                <img src={resolveMediaUrl(localData.branding?.logoUrl)} className="h-10 object-contain mb-4" alt="Logo"/>
                <label className="block w-full py-2 bg-charcoal text-white text-center text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-black transition-all">
                  {uploading === 'branding-logoUrl' ? 'Syncing...' : 'Change Logo'}
                  <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload('branding', 'logoUrl', e.target.files[0])}/>
                </label>
              </div>
            </div>
            <div className="space-y-4">
              <label className={labelClass}>Site Favicon</label>
              <div className="p-4 border border-charcoal/5 rounded bg-white shadow-sm">
                <img src={resolveMediaUrl(localData.branding?.faviconUrl)} className="h-8 w-8 object-contain mb-4 mx-auto" alt="Favicon"/>
                <label className="block w-full py-2 bg-charcoal text-white text-center text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-black transition-all">
                  {uploading === 'branding-faviconUrl' ? 'Syncing...' : 'Change Favicon'}
                  <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload('branding', 'faviconUrl', e.target.files[0])}/>
                </label>
              </div>
            </div>
            <button onClick={() => handleSave('branding')} className="w-full py-3 bg-charcoal text-white rounded text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-black">
              <Save size={14}/> Save Branding
            </button>
          </div>
        )
      case 'hero':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={labelClass}>Headline</label>
              <input type="text" value={localData.hero?.title || ''} onChange={(e) => handleLocalChange('hero', 'title', e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Subtitle</label>
              <textarea value={localData.hero?.subtitle || ''} onChange={(e) => handleLocalChange('hero', 'subtitle', e.target.value)} rows={3} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Est. Date</label>
                <input type="text" value={localData.hero?.establishmentDate || ''} onChange={(e) => handleLocalChange('hero', 'establishmentDate', e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>CTA Label</label>
                <input type="text" value={localData.hero?.buttonText || ''} onChange={(e) => handleLocalChange('hero', 'buttonText', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="p-4 bg-warm-stone/20 border border-charcoal/5 rounded-md space-y-4">
              <div className="flex items-center justify-between">
                 <label className={labelClass + ' mb-0'}>Idle Fade Behavior</label>
                 <select value={localData.hero?.idleHideDelaySeconds === null ? 'never' : 'timed'} onChange={(e) => handleLocalChange('hero', 'idleHideDelaySeconds', e.target.value === 'never' ? null : 25)} className="text-[11px] font-bold bg-transparent outline-none">
                    <option value="timed">TIMED</option>
                    <option value="never">OFF</option>
                  </select>
              </div>
              {localData.hero?.idleHideDelaySeconds !== null && (
                <div className="flex items-center justify-between border-t border-charcoal/5 pt-3">
                   <span className="text-[12px] text-charcoal/60">Fade Interval (Sec)</span>
                   <input type="number" value={localData.hero?.idleHideDelaySeconds || 25} onChange={(e) => handleLocalChange('hero', 'idleHideDelaySeconds', parseInt(e.target.value))} className="w-16 text-right bg-transparent border-b border-charcoal/10 outline-none text-[12px] font-bold" min="15" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className={labelClass}>Video Showcase</label>
                <button onClick={() => handleLocalChange('hero', 'videoUrls', [...(localData.hero?.videoUrls || []), ''])} className="text-[10px] font-bold text-brass uppercase hover:underline">+ Add Slot</button>
              </div>
              {(localData.hero?.videoUrls || []).map((url: string, i: number) => (
                <div key={i} className="flex flex-col gap-2 p-3 border border-charcoal/5 rounded-md bg-white">
                  <div className="flex gap-2">
                    <input type="text" value={url} onChange={e => {
                       const list = [...localData.hero.videoUrls]; list[i] = e.target.value; handleLocalChange('hero', 'videoUrls', list)
                    }} className="flex-1 text-[11px] font-mono bg-warm-stone/30 px-2 py-1.5 rounded border-none outline-none" placeholder="Video Path" />
                    <button onClick={() => {
                       const list = localData.hero.videoUrls.filter((_:any, idx:number) => idx !== i); handleLocalChange('hero', 'videoUrls', list)
                    }} className="p-1.5 text-charcoal/20 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-charcoal/40 hover:text-charcoal cursor-pointer uppercase transition-colors">
                     <Video size={12}/> {uploading === `hero-videoUrls-${i}` ? 'Syncing...' : 'Upload File'}
                     <input type="file" className="hidden" accept="video/mp4" onChange={e => e.target.files?.[0] && handleFileUpload('hero', 'videoUrls', e.target.files[0], i)}/>
                  </label>
                </div>
              ))}
            </div>
            <button onClick={() => handleSave('hero')} className="w-full py-3 bg-charcoal text-white rounded text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-black transition-colors">
              {isSaving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>} Save Hero
            </button>
          </div>
        )
      case 'about':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={labelClass}>Heading</label>
              <input type="text" value={localData.about?.title || ''} onChange={(e) => handleLocalChange('about', 'title', e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Narrative (Paragraphs)</label>
              <textarea value={(localData.about?.description || []).join('\n\n')} onChange={(e) => handleLocalChange('about', 'description', e.target.value.split('\n\n').filter(p => p.trim()))} rows={6} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Display Asset</label>
              <div className="border border-charcoal/5 rounded overflow-hidden bg-warm-stone/10 shadow-sm">
                <img src={resolveMediaUrl(localData.about?.imageUrl)} className="h-32 w-full object-cover grayscale opacity-60" alt="About"/>
                <label className="block w-full py-2 bg-white text-center text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-warm-stone transition-all border-t border-charcoal/5">
                  {uploading === 'about-imageUrl' ? 'Syncing...' : 'Change Asset'}
                  <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload('about', 'imageUrl', e.target.files[0])}/>
                </label>
              </div>
            </div>
            <button onClick={() => handleSave('about')} className="w-full py-3 bg-charcoal text-white rounded text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-black">
               <Save size={14}/> Save About
            </button>
          </div>
        )
      case 'values':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-warm-stone/20 border border-charcoal/5 rounded">
              <div className="space-y-1">
                <label className={labelClass}>Auto-Slide</label>
                <select value={localData.values_settings?.autoSlide ? 'on' : 'off'} onChange={e => handleLocalChange('values_settings', 'autoSlide', e.target.value === 'on')} className="w-full bg-transparent text-[11px] font-bold outline-none uppercase">
                  <option value="on">Active</option>
                  <option value="off">Off</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Delay (Sec)</label>
                <input type="number" value={localData.values_settings?.delaySeconds || 15} onChange={e => handleLocalChange('values_settings', 'delaySeconds', parseInt(e.target.value))} className="w-full bg-transparent text-[11px] font-bold outline-none" min="5" />
              </div>
              <button onClick={() => handleSave('values_settings')} className="col-span-2 py-1.5 border border-charcoal/10 rounded text-[9px] font-bold uppercase hover:bg-charcoal hover:text-white transition-all">Save Slider Behavior</button>
            </div>
            <div className="flex justify-between items-center"><label className={labelClass}>Principles</label><button onClick={addValueItem} className="text-[10px] font-bold text-brass uppercase hover:underline">+ Add Principle</button></div>
            <div className="space-y-3">
              {(localData.values || []).map((v: any, i: number) => (
                <div key={i} className="p-4 border border-charcoal/5 rounded bg-white shadow-sm space-y-3">
                   <div className="flex justify-between items-center text-[10px] font-bold text-charcoal/30 uppercase">
                     <span>Item {i+1}</span>
                     <div className="flex gap-1"><button onClick={() => moveValueItem(i, -1)} disabled={i === 0} className="w-6 h-6 border border-charcoal/5 rounded flex items-center justify-center hover:bg-warm-stone disabled:opacity-20"><ChevronUp size={12}/></button><button onClick={() => moveValueItem(i, 1)} disabled={i === localData.values.length-1} className="w-6 h-6 border border-charcoal/5 rounded flex items-center justify-center hover:bg-warm-stone disabled:opacity-20"><ChevronDown size={12}/></button><button onClick={() => { const list = [...localData.values]; list.splice(i,1); setLocalData((prev:any)=>({...prev, values:list})) }} className="w-6 h-6 text-red-300 hover:text-red-500"><Trash2 size={12}/></button></div>
                   </div>
                   <input type="text" value={v.title} onChange={e => updateValueItem(i, 'title', e.target.value)} placeholder="Title" className={inputClass} />
                   <textarea value={v.description} onChange={e => updateValueItem(i, 'description', e.target.value)} placeholder="Description" rows={2} className={inputClass} />
                </div>
              ))}
            </div>
            <button onClick={() => handleSave('values')} className="w-full py-3 bg-charcoal text-white rounded text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-black"><Save size={14}/> Save Values</button>
          </div>
        )
      case 'contact':
        return (
          <div className="space-y-6">
            <div className="space-y-2"><label className={labelClass}>HQ Address</label><input type="text" value={localData.contact?.address || ''} onChange={e => handleLocalChange('contact', 'address', e.target.value)} className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className={labelClass}>Phone</label><input type="text" value={localData.contact?.phone || ''} onChange={e => handleLocalChange('contact', 'phone', e.target.value)} className={inputClass} /></div>
              <div className="space-y-2"><label className={labelClass}>Email</label><input type="text" value={localData.contact?.email || ''} onChange={e => handleLocalChange('contact', 'email', e.target.value)} className={inputClass} /></div>
            </div>
            <div className="space-y-2"><label className={labelClass}>Map URL</label><textarea value={localData.contact?.mapUrl || ''} onChange={e => handleLocalChange('contact', 'mapUrl', e.target.value)} rows={3} className={inputClass} /></div>
            <button onClick={() => handleSave('contact')} className="w-full py-3 bg-charcoal text-white rounded text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-black"><Save size={14}/> Save Contact</button>
          </div>
        )
      case 'footer':
        return (
          <div className="space-y-6">
            <div className="space-y-2"><label className={labelClass}>Copyright</label><input type="text" value={localData.footer?.copyright || ''} onChange={e => handleLocalChange('footer', 'copyright', e.target.value)} className={inputClass} /></div>
            <div className="space-y-2"><label className={labelClass}>Reg No.</label><input type="text" value={localData.footer?.registrationNumber || ''} onChange={e => handleLocalChange('footer', 'registrationNumber', e.target.value)} className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-4">
              {['facebook', 'linkedin', 'instagram', 'twitter'].map(p => (
                <div key={p} className="space-y-1">
                  <label className={labelClass}>{p}</label>
                  <input type="text" value={localData.footer?.socials?.[p] || ''} onChange={e => handleLocalChange('footer', 'socials', {...localData.footer.socials, [p]: e.target.value})} className={inputClass} />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center"><label className={labelClass}>Extra Handles</label><button onClick={addExtraFooterSocial} className="text-[10px] font-bold text-brass uppercase hover:underline">+ Add</button></div>
              {getExtraFooterSocials().map((s:any, i:number) => (
                <div key={i} className="flex gap-2">
                  <input type="text" placeholder="Platform" value={s.label} onChange={e => updateExtraFooterSocial(i, 'label', e.target.value)} className="w-1/3 px-3 py-2 border border-charcoal/10 rounded text-xs" />
                  <input type="text" placeholder="Handle" value={s.url} onChange={e => updateExtraFooterSocial(i, 'url', e.target.value)} className="flex-1 px-3 py-2 border border-charcoal/10 rounded text-xs" />
                  <button onClick={() => { const list = getExtraFooterSocials().filter((_:any,idx:number)=>idx!==i); handleLocalChange('footer', 'socials', {...localData.footer.socials, extra: list}) }} className="text-red-300 p-2"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
            <button onClick={() => handleSave('footer')} className="w-full py-3 bg-charcoal text-white rounded text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-black"><Save size={14}/> Save Footer</button>
          </div>
        )
      case 'legal':
        return (
          <div className="space-y-6">
            <div className="space-y-2"><label className={labelClass}>Privacy HTML</label><textarea value={localData.privacy_policy?.html || ''} onChange={e => handleLocalChange('privacy_policy', 'html', e.target.value)} rows={8} className="w-full p-3 border border-charcoal/10 rounded font-mono text-[10px] focus:border-charcoal outline-none" /></div>
            <div className="space-y-2"><label className={labelClass}>Cookie HTML</label><textarea value={localData.cookie_policy?.html || ''} onChange={e => handleLocalChange('cookie_policy', 'html', e.target.value)} rows={8} className="w-full p-3 border border-charcoal/10 rounded font-mono text-[10px] focus:border-charcoal outline-none" /></div>
            <div className="grid grid-cols-2 gap-4 pt-4"><button onClick={()=>handleSave('privacy_policy')} className="py-2 bg-charcoal text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-black">Save Privacy</button><button onClick={()=>handleSave('cookie_policy')} className="py-2 bg-charcoal text-white rounded text-[11px] font-bold uppercase tracking-wider hover:bg-black">Save Cookies</button></div>
          </div>
        )
      default: return null
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-white">
      {/* CMS Toolbar */}
      <div className="h-14 border-b border-charcoal/5 flex items-center justify-between px-6 bg-white shrink-0">
         <div className="flex h-full">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-5 h-full text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center shrink-0 ${
                  activeSection === s.id ? 'border-charcoal text-charcoal' : 'border-transparent text-charcoal/30 hover:text-charcoal/60'
                }`}
              >
                {s.label}
              </button>
            ))}
         </div>
         <div className="flex items-center gap-3">
            <div className="flex bg-warm-stone/50 p-0.5 rounded border border-charcoal/5">
              <button onClick={() => setViewMode('desktop')} className={`p-1.5 rounded transition-all ${viewMode === 'desktop' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/20 hover:text-charcoal/40'}`}><Monitor size={14}/></button>
              <button onClick={() => setViewMode('mobile')} className={`p-1.5 rounded transition-all ${viewMode === 'mobile' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/20 hover:text-charcoal/40'}`}><Smartphone size={14}/></button>
            </div>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor (60%) */}
        <div className="w-[60%] border-r border-charcoal/5 overflow-y-auto p-8 bg-warm-stone/5 no-scrollbar corporative-editor">
           <div className="max-w-md mx-auto">
              <div className="mb-8 border-b border-charcoal/5 pb-4">
                 <h2 className="text-xl font-semibold text-charcoal tracking-tight">Editing {sections.find(s=>s.id===activeSection)?.label}</h2>
                 <p className="text-[12px] text-charcoal/40 mt-1">Changes are saved directly to the enterprise stream.</p>
              </div>
              {renderEditor()}
           </div>
        </div>

        {/* Preview (40%) */}
        <div className="w-[40%] bg-warm-stone/30 flex flex-col relative p-12 overflow-y-auto no-scrollbar" ref={containerRef}>
           <div className="w-full max-w-[800px] mx-auto flex flex-col items-center gap-8">
              <div className="w-full flex items-center justify-between">
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-charcoal/30 flex items-center gap-2"><Eye size={12}/> Viewport Sync</span>
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-charcoal/30">{viewMode} mode active</span>
              </div>

              {/* THE IFRAME FIX: Absolute viewport isolation */}
              <div
                className={`bg-white shadow-2xl transition-all duration-500 overflow-hidden relative border border-charcoal/10 corporative-preview`}
                style={{
                  width: viewMode === 'desktop' ? '1280px' : '375px',
                  height: viewMode === 'desktop' ? '800px' : '600px',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  borderRadius: viewMode === 'desktop' ? '8px' : '24px'
                }}
              >
                <iframe
                  ref={iframeRef}
                  src={`/admin/preview?section=${activeSection}`}
                  className="w-full h-full border-none"
                  title="Mobile Sandbox"
                  onLoad={syncIframe}
                />
              </div>

              <div className="w-full p-4 bg-charcoal rounded-lg flex items-center justify-between border border-white/5 shadow-xl">
                 <p className="text-[11px] text-white/40 font-medium">This is an isolated section preview of your live identity.</p>
                 <button className="text-white/60 hover:text-white transition-all"><ExternalLink size={14}/></button>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
function ExternalLink({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
  )
}
