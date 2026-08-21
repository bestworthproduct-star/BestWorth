import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Pencil, Plus, Search, Shield, Trash2, UserRound, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import type { AuthUser, PermissionLevel, PermissionModule, Permissions } from '@/types/auth'

const modules: { id: PermissionModule; label: string; description: string }[] = [
  { id: 'overview', label: 'Overview', description: 'Dashboard totals and activity summary' },
  { id: 'catalog', label: 'Catalog', description: 'Products and product categories' },
  { id: 'leadership', label: 'Leadership', description: 'Executive profiles and slider settings' },
  { id: 'inquiries', label: 'Inquiries', description: 'Customer messages, replies and status' },
  { id: 'media', label: 'News & Media', description: 'News articles, videos and publishing' },
  { id: 'cms', label: 'Site CMS', description: 'Public website content and media' }
]
const levels: PermissionLevel[] = ['none', 'view', 'manage']
const defaultPermissions: Permissions = { overview: 'view', catalog: 'none', leadership: 'none', inquiries: 'none', media: 'none', cms: 'none' }

interface WorkerResult { worker: AuthUser; temporaryPassword?: string }
interface ActivityItem { _id: string; action: string; createdAt: string }

export default function WorkerAccessManager() {
  const [workers, setWorkers] = useState<AuthUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ fullName: '', username: '', email: '', permissions: { ...defaultPermissions } })
  const [editForm, setEditForm] = useState({ fullName: '', username: '', email: '' })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const token = 'cookie-session'
  const selected = workers.find((worker) => worker.id === selectedId) || null
  const normalizedSearch = search.trim().toLowerCase()
  const filteredWorkers = workers.filter((worker) => {
    if (!normalizedSearch) return true
    return [worker.fullName, worker.username, worker.email]
      .some((value) => value?.toLowerCase().includes(normalizedSearch))
  })

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Request failed')
    return result
  }, [token])

  const loadWorkers = useCallback(async () => {
    try {
      const result = await request('/api/workers') as AuthUser[]
      setWorkers(result)
      setSelectedId((current) => current || result[0]?.id || null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load workers')
    }
  }, [request])

  useEffect(() => { void loadWorkers() }, [loadWorkers])

  useEffect(() => {
    if (!selectedId) { setActivity([]); return }
    request(`/api/workers/${selectedId}/activity`)
      .then((result) => setActivity(result as ActivityItem[]))
      .catch(() => setActivity([]))
  }, [request, selectedId])

  const createWorker = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await request('/api/workers', { method: 'POST', body: JSON.stringify(form) }) as WorkerResult
      setTemporaryPassword(result.temporaryPassword || '')
      setWorkers((current) => [result.worker, ...current])
      setSelectedId(result.worker.id)
      setShowCreate(false)
      setForm({ fullName: '', username: '', email: '', permissions: { ...defaultPermissions } })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create worker')
    } finally {
      setSaving(false)
    }
  }

  const updateSelected = (worker: AuthUser) => setWorkers((current) => current.map((item) => item.id === worker.id ? worker : item))

  const updatePermissions = async (permissions: Permissions) => {
    if (!selected) return
    updateSelected({ ...selected, permissions })
    try {
      const result = await request(`/api/workers/${selected.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) }) as WorkerResult
      updateSelected(result.worker)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update permissions')
      void loadWorkers()
    }
  }

  const toggleStatus = async () => {
    if (!selected) return
    try {
      const result = await request(`/api/workers/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !selected.active }) }) as WorkerResult
      updateSelected(result.worker)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not change account status')
    }
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const result = await request(`/api/workers/${selected.id}`, { method: 'PATCH', body: JSON.stringify(editForm) }) as WorkerResult
      updateSelected(result.worker)
      setShowEdit(false)
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not update worker')
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async () => {
    if (!selected || !window.confirm(`Issue a new temporary password for ${selected.fullName || selected.username}?`)) return
    try {
      const result = await request(`/api/workers/${selected.id}/reset-password`, { method: 'POST' }) as WorkerResult
      updateSelected(result.worker)
      setTemporaryPassword(result.temporaryPassword || '')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset password')
    }
  }

  const deleteWorker = async () => {
    if (!selected || selected.active) return
    setDeleting(true)
    setError('')
    try {
      await request(`/api/workers/${selected.id}`, { method: 'DELETE' })
      const remainingWorkers = workers.filter((worker) => worker.id !== selected.id)
      setWorkers(remainingWorkers)
      setSelectedId(remainingWorkers[0]?.id || null)
      setShowDeleteConfirm(false)
      setActivity([])
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete worker')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-[#102B4C]/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#102B4C]"><Shield size={17} /><h2 className="text-[13px] font-semibold">Worker access</h2></div>
          <p className="mt-1 text-[11px] leading-5 text-[#102B4C]/50">Give each person only the areas and actions required for their work.</p>
        </div>
        <button onClick={() => { setError(''); setShowCreate(true) }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#102B4C] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#060273]"><Plus size={14} /> Add worker</button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">{error}</div>}
      {temporaryPassword && (
        <div className="rounded-lg border border-[#060273]/15 bg-[#F5F8FC] p-4 sm:flex sm:items-center sm:justify-between">
          <div><p className="text-[11px] font-semibold text-[#102B4C]">Temporary password — shown once</p><code className="mt-1 block text-[14px] text-[#060273]">{temporaryPassword}</code></div>
          <div className="mt-3 flex gap-2 sm:mt-0"><button onClick={() => void navigator.clipboard.writeText(temporaryPassword)} className="inline-flex items-center gap-2 rounded-md border border-[#102B4C]/10 bg-white px-3 py-2 text-[11px] text-[#102B4C]"><Copy size={13}/> Copy</button><button onClick={() => setTemporaryPassword('')} className="rounded-md p-2 text-[#102B4C]/40"><X size={15}/></button></div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="max-h-[720px] self-start overflow-hidden rounded-lg border border-[#102B4C]/10 bg-white">
          <div className="border-b border-[#102B4C]/8 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#102B4C]/40">Team accounts · {workers.length}</div>
          {workers.length > 0 && <div className="border-b border-[#102B4C]/8 p-3"><div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#102B4C]/30"/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workers…" aria-label="Search workers" className="w-full rounded-md border border-[#102B4C]/10 bg-[#F7F9FC] py-2.5 pl-9 pr-3 text-[11px] text-[#102B4C] outline-none placeholder:text-[#102B4C]/30 focus:border-[#060273]/30 focus:ring-2 focus:ring-[#060273]/5"/></div></div>}
          <div className={filteredWorkers.length > 10 ? 'max-h-[620px] overflow-y-auto [scrollbar-width:thin]' : ''}>
          {workers.length === 0 ? <div className="p-8 text-center"><UserRound className="mx-auto text-[#102B4C]/20"/><p className="mt-3 text-[12px] text-[#102B4C]/50">No worker accounts yet.</p></div> : filteredWorkers.length === 0 ? <div className="p-8 text-center"><Search className="mx-auto text-[#102B4C]/20"/><p className="mt-3 text-[12px] text-[#102B4C]/50">No workers match your search.</p><button onClick={() => setSearch('')} className="mt-3 text-[10px] font-semibold text-[#060273]">Clear search</button></div> : <>
          {filteredWorkers.map((worker) => (
            <button key={worker.id} onClick={() => setSelectedId(worker.id)} className={`h-[62px] w-full border-b border-[#102B4C]/6 px-4 text-left transition ${selectedId === worker.id ? 'bg-[#F5F8FC]' : 'hover:bg-[#FAFBFD]'}`}>
              <div className="flex items-center justify-between gap-3"><span className="truncate text-[12px] font-semibold text-[#102B4C]">{worker.fullName || worker.username}</span><span className={`h-2 w-2 shrink-0 rounded-full ${worker.active ? 'bg-emerald-500' : 'bg-slate-300'}`} /></div>
              <p className="mt-1 truncate text-[10px] text-[#102B4C]/45">@{worker.username} · {worker.active ? 'Active' : 'Disabled'}</p>
            </button>
          ))}
          </>}
          </div>
        </aside>

        <section className="rounded-lg border border-[#102B4C]/10 bg-white p-5 sm:p-7">
          {!selected ? <div className="py-16 text-center text-[12px] text-[#102B4C]/45">Select a worker to review access.</div> : <>
            <div className="flex flex-col gap-4 border-b border-[#102B4C]/8 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-lg font-semibold text-[#102B4C]">{selected.fullName || selected.username}</p><p className="mt-1 text-[11px] text-[#102B4C]/45">{selected.email} · Last sign-in {selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleString() : 'Never'}</p></div>
              <div className="flex flex-wrap gap-2"><button onClick={() => { setEditForm({ fullName: selected.fullName, username: selected.username, email: selected.email }); setShowEdit(true) }} className="inline-flex items-center gap-2 rounded-md border border-[#102B4C]/10 px-3 py-2 text-[10px] font-semibold text-[#102B4C]"><Pencil size={12}/> Edit details</button><button onClick={resetPassword} className="inline-flex items-center gap-2 rounded-md border border-[#102B4C]/10 px-3 py-2 text-[10px] font-semibold text-[#102B4C]"><KeyRound size={13}/> Reset password</button><button onClick={toggleStatus} className={`rounded-md px-3 py-2 text-[10px] font-semibold ${selected.active ? 'border border-red-200 text-red-700' : 'bg-[#102B4C] text-white'}`}>{selected.active ? 'Disable account' : 'Enable account'}</button>{!selected.active && <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700 transition hover:bg-red-100"><Trash2 size={12}/> Delete account</button>}</div>
            </div>
            <div className="mt-6"><h3 className="text-[11px] font-semibold text-[#102B4C]">Module permissions</h3><p className="mt-1 text-[10px] text-[#102B4C]/45">View allows reading. Manage also allows creating, editing and deleting.</p></div>
            <div className="mt-4 divide-y divide-[#102B4C]/7 rounded-lg border border-[#102B4C]/10">
              {modules.map((moduleItem) => <div key={moduleItem.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><p className="text-[12px] font-semibold text-[#102B4C]">{moduleItem.label}</p><p className="mt-0.5 text-[10px] text-[#102B4C]/45">{moduleItem.description}</p></div><div className="grid grid-cols-3 rounded-md bg-[#F5F8FC] p-1">{levels.map((level) => <button key={level} onClick={() => void updatePermissions({ ...selected.permissions, [moduleItem.id]: level })} className={`min-w-[70px] rounded px-3 py-1.5 text-[9px] font-semibold capitalize transition ${selected.permissions[moduleItem.id] === level ? 'bg-white text-[#060273] shadow-sm' : 'text-[#102B4C]/40'}`}>{selected.permissions[moduleItem.id] === level && <Check size={10} className="mr-1 inline"/>}{level}</button>)}</div></div>)}
            </div>
            <div className="mt-7 border-t border-[#102B4C]/8 pt-6"><h3 className="text-[11px] font-semibold text-[#102B4C]">Recent access activity</h3><div className={`mt-3 space-y-2 ${activity.length > 5 ? 'max-h-[212px] overflow-y-auto pr-2 [scrollbar-width:thin]' : ''}`}>{activity.length === 0 ? <p className="text-[10px] text-[#102B4C]/40">No recorded security activity yet.</p> : activity.map((item) => <div key={item._id} className="flex min-h-9 items-center justify-between gap-4 rounded-md bg-[#F7F9FC] px-3 py-2"><span className="text-[10px] text-[#102B4C]/65">{item.action.replaceAll('.', ' ')}</span><time className="shrink-0 text-[9px] text-[#102B4C]/35">{new Date(item.createdAt).toLocaleString()}</time></div>)}</div></div>
          </>}
        </section>
      </div>

      {showCreate && <div className="fixed inset-0 z-[220] flex items-center justify-center p-4"><div className="absolute inset-0 bg-[#102B4C]/45 backdrop-blur-sm" onClick={() => setShowCreate(false)}/><section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold text-[#102B4C]">Add a worker</h2><p className="mt-1 text-[11px] text-[#102B4C]/50">Create the account and choose its starting access.</p></div><button onClick={() => setShowCreate(false)} className="p-2 text-[#102B4C]/40"><X size={17}/></button></div><form onSubmit={createWorker} className="mt-7 space-y-6"><div className="grid gap-4 sm:grid-cols-2">{([['fullName','Full name'],['username','Username'],['email','Work email']] as const).map(([key,label]) => <label key={key} className={key === 'email' ? 'sm:col-span-2 text-[11px] font-semibold text-[#102B4C]/65' : 'text-[11px] font-semibold text-[#102B4C]/65'}>{label}<input type={key === 'email' ? 'email' : 'text'} required value={form[key]} onChange={(event) => setForm({...form,[key]:event.target.value})} className="mt-2 w-full rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC] px-4 py-3 text-sm outline-none focus:border-[#060273]/35"/></label>)}</div><div><p className="text-[11px] font-semibold text-[#102B4C]/65">Starting permissions</p><div className="mt-3 space-y-2">{modules.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-[#102B4C]/8 px-3 py-2"><span className="text-[11px] text-[#102B4C]">{item.label}</span><select value={form.permissions[item.id]} onChange={(event) => setForm({...form,permissions:{...form.permissions,[item.id]:event.target.value as PermissionLevel}})} className="rounded-md border border-[#102B4C]/10 bg-white px-3 py-2 text-[10px]"><option value="none">No access</option><option value="view">View only</option><option value="manage">Manage</option></select></div>)}</div></div><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-[11px] text-[#102B4C]/55">Cancel</button><button disabled={saving} className="rounded-lg bg-[#102B4C] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create worker'}</button></div></form></section></div>}
      {showEdit && selected && <div className="fixed inset-0 z-[220] flex items-center justify-center p-4"><div className="absolute inset-0 bg-[#102B4C]/45 backdrop-blur-sm" onClick={() => setShowEdit(false)}/><section className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-[#102B4C]">Edit worker details</h2><button onClick={() => setShowEdit(false)} className="p-2 text-[#102B4C]/40"><X size={17}/></button></div><form onSubmit={saveProfile} className="mt-6 space-y-4">{([['fullName','Full name'],['username','Username'],['email','Work email']] as const).map(([key,label]) => <label key={key} className="block text-[11px] font-semibold text-[#102B4C]/65">{label}<input type={key === 'email' ? 'email' : 'text'} required value={editForm[key]} onChange={(event) => setEditForm({...editForm,[key]:event.target.value})} className="mt-2 w-full rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC] px-4 py-3 text-sm outline-none focus:border-[#060273]/35"/></label>)}<div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2.5 text-[11px] text-[#102B4C]/55">Cancel</button><button disabled={saving} className="rounded-lg bg-[#102B4C] px-5 py-2.5 text-[11px] font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div></form></section></div>}
      {showDeleteConfirm && selected && <div className="fixed inset-0 z-[230] flex items-center justify-center p-4"><div className="absolute inset-0 bg-[#102B4C]/55 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteConfirm(false)}/><section role="alertdialog" aria-modal="true" aria-labelledby="delete-worker-title" className="relative w-full max-w-md rounded-xl border border-red-100 bg-white p-6 shadow-2xl sm:p-8"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700"><Trash2 size={18}/></div><h2 id="delete-worker-title" className="mt-5 text-xl font-semibold text-[#102B4C]">Permanently delete account?</h2><p className="mt-2 text-[12px] leading-6 text-[#102B4C]/55"><strong className="font-semibold text-[#102B4C]">{selected.fullName || selected.username}</strong> will be removed from the database and will no longer be able to sign in. This action cannot be undone.</p><div className="mt-7 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setShowDeleteConfirm(false)} className="rounded-lg px-4 py-2.5 text-[11px] font-semibold text-[#102B4C]/55 disabled:opacity-50">Cancel</button><button type="button" disabled={deleting} onClick={() => void deleteWorker()} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"><Trash2 size={13}/>{deleting ? 'Deleting…' : 'Delete account'}</button></div></section></div>}
    </div>
  )
}
