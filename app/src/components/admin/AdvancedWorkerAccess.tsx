import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import type { AuthUser, PermissionModule } from '@/types/auth'

type GrantLevel = 'view' | 'manage'

interface WorkerAccessGrant {
  id: string
  actor: AuthUser
  target: AuthUser
  level: GrantLevel
  reason: string
  grantedBy: { id: string; fullName: string; username: string }
  createdAt: string
  updatedAt: string
}

interface AdvancedWorkerAccessProps { onBack: () => void }

const levelRank = { none: 0, view: 1, manage: 2 }
const delegatedModules: PermissionModule[] = ['overview', 'catalog', 'leadership', 'inquiries', 'media', 'cms']
const inputClass = 'w-full rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC] px-4 py-3 text-[11px] text-[#102B4C] outline-none transition placeholder:text-[#102B4C]/28 focus:border-[#060273]/35 focus:ring-2 focus:ring-[#060273]/5'

const workerLabel = (worker: AuthUser) => worker.fullName || worker.username
const matchesWorker = (worker: AuthUser, query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [worker.fullName, worker.username, worker.email, worker.jobTitle]
    .some((value) => String(value || '').toLowerCase().includes(normalized))
}

export default function AdvancedWorkerAccess({ onBack }: AdvancedWorkerAccessProps) {
  const [workers, setWorkers] = useState<AuthUser[]>([])
  const [grants, setGrants] = useState<WorkerAccessGrant[]>([])
  const [actorId, setActorId] = useState('')
  const [actorSearch, setActorSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [allEligible, setAllEligible] = useState(true)
  const [level, setLevel] = useState<GrantLevel>('view')
  const [reason, setReason] = useState('')
  const [grantSearch, setGrantSearch] = useState('')
  const [expandedActors, setExpandedActors] = useState<string[]>([])
  const [confirmingGrant, setConfirmingGrant] = useState(false)
  const [revokeGrant, setRevokeGrant] = useState<WorkerAccessGrant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer cookie-session', ...options?.headers }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Request failed')
    return result
  }, [])

  const loadAccess = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await request('/api/workers/access-grants') as { workers: AuthUser[]; grants: WorkerAccessGrant[] }
      setWorkers(result.workers); setGrants(result.grants)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Advanced access could not be loaded')
    } finally { setLoading(false) }
  }, [request])

  useEffect(() => { void loadAccess() }, [loadAccess])

  const workerById = useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers])
  const selectedActor = workerById.get(actorId) || null

  const isAncestor = useCallback((possibleAncestorId: string, workerId: string) => {
    const visited = new Set<string>()
    let currentId: string | null = workerId
    for (let depth = 0; depth < 50 && currentId; depth += 1) {
      if (visited.has(currentId)) return false
      visited.add(currentId)
      const parentId: string | null = workerById.get(currentId)?.createdBy || null
      if (parentId === possibleAncestorId) return true
      currentId = parentId
    }
    return false
  }, [workerById])

  const canManageTarget = useCallback((actor: AuthUser, target: AuthUser) => delegatedModules
    .every((moduleName) => levelRank[target.permissions[moduleName]] <= levelRank[actor.permissions[moduleName]]), [])

  const eligibleActors = useMemo(() => workers.filter((worker) => worker.active
    && levelRank[worker.permissions.workers] >= levelRank[level]), [level, workers])
  const eligibleTargets = useMemo(() => !selectedActor ? [] : workers.filter((worker) => worker.active
    && worker.id !== selectedActor.id
    && !isAncestor(selectedActor.id, worker.id)
    && !isAncestor(worker.id, selectedActor.id)
    && (level !== 'manage' || canManageTarget(selectedActor, worker))), [canManageTarget, isAncestor, level, selectedActor, workers])
  const eligibleTargetIds = useMemo(() => new Set(eligibleTargets.map((worker) => worker.id)), [eligibleTargets])
  const targetIds = allEligible ? eligibleTargets.map((worker) => worker.id) : selectedTargetIds.filter((id) => eligibleTargetIds.has(id))
  const protectedCount = selectedActor ? workers.filter((worker) => worker.active && worker.id !== selectedActor.id).length - eligibleTargets.length : 0

  useEffect(() => {
    if (actorId && !eligibleActors.some((worker) => worker.id === actorId)) {
      setActorId(''); setActorSearch(''); setSelectedTargetIds([])
    }
  }, [actorId, eligibleActors])

  useEffect(() => {
    setSelectedTargetIds((current) => current.filter((id) => eligibleTargetIds.has(id)))
  }, [eligibleTargetIds])

  const actorResults = eligibleActors.filter((worker) => matchesWorker(worker, actorSearch)).slice(0, 8)
  const targetResults = eligibleTargets.filter((worker) => matchesWorker(worker, targetSearch))

  const groupedGrants = useMemo(() => {
    const normalized = grantSearch.trim().toLowerCase()
    const filtered = grants.filter((grant) => !normalized || [
      grant.actor.fullName, grant.actor.username, grant.actor.email, grant.target.fullName,
      grant.target.username, grant.target.email, grant.reason, grant.level
    ].some((value) => String(value || '').toLowerCase().includes(normalized)))
    const groups = new Map<string, { actor: AuthUser; grants: WorkerAccessGrant[] }>()
    filtered.forEach((grant) => {
      const current = groups.get(grant.actor.id) || { actor: grant.actor, grants: [] }
      current.grants.push(grant); groups.set(grant.actor.id, current)
    })
    return [...groups.values()]
  }, [grantSearch, grants])

  const prepareGrant = (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (!selectedActor) return setError('Search for and select the worker receiving access.')
    if (targetIds.length === 0) return setError('No eligible workers are selected for this access level.')
    if (reason.trim().length < 10) return setError('Explain the reason in at least 10 characters.')
    setConfirmingGrant(true)
  }

  const confirmGrant = async () => {
    if (!selectedActor || targetIds.length === 0) return
    setSaving(true); setError('')
    try {
      await request('/api/workers/access-grants', {
        method: 'POST', body: JSON.stringify({ actorId: selectedActor.id, targetIds, level, reason })
      })
      setConfirmingGrant(false); setActorId(''); setActorSearch(''); setTargetSearch('')
      setSelectedTargetIds([]); setAllEligible(true); setLevel('view'); setReason('')
      await loadAccess()
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : 'Advanced access could not be granted')
      setConfirmingGrant(false)
    } finally { setSaving(false) }
  }

  const confirmRevoke = async () => {
    if (!revokeGrant) return
    setSaving(true); setError('')
    try {
      await request(`/api/workers/access-grants/${revokeGrant.id}`, { method: 'DELETE' })
      setGrants((current) => current.filter((grant) => grant.id !== revokeGrant.id)); setRevokeGrant(null)
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Advanced access could not be revoked')
      setRevokeGrant(null)
    } finally { setSaving(false) }
  }

  const selectActor = (worker: AuthUser) => {
    setActorId(worker.id); setActorSearch(''); setTargetSearch(''); setSelectedTargetIds([]); setAllEligible(true)
  }
  const toggleTarget = (id: string) => setSelectedTargetIds((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id])

  return <div className="space-y-6">
    <header className="border-b border-[#102B4C]/10 pb-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-[10px] font-semibold text-[#102B4C]/50 transition hover:text-[#102B4C]"><ArrowLeft size={13}/> Worker access</button>
      <div className="mt-5 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F8FC] text-[#060273]"><ShieldCheck size={16}/></div><div><h1 className="text-[17px] font-semibold text-[#102B4C]">Advanced worker access</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#102B4C]/50">Give one worker controlled access across other lineages. Protected accounts remain excluded, normal permissions still apply and the company reporting structure never changes.</p></div></div>
    </header>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</div>}

    <form onSubmit={prepareGrant} className="rounded-lg border border-[#102B4C]/10 bg-white">
      <Step number="01" title="Choose the receiving worker" description="Search by name, email, username or company role.">
        {!selectedActor ? <><div className="relative"><Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#102B4C]/30"/><input autoComplete="off" type="search" value={actorSearch} onChange={(event) => setActorSearch(event.target.value)} placeholder="Search workers…" aria-label="Search for receiving worker" className={`${inputClass} pl-11`}/></div><div className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-[#102B4C]/8 [scrollbar-width:thin]">{loading ? <p className="p-5 text-center text-[10px] text-[#102B4C]/40">Loading workers…</p> : actorResults.length === 0 ? <p className="p-5 text-center text-[10px] text-[#102B4C]/40">No eligible workers match your search.</p> : actorResults.map((worker) => <button key={worker.id} type="button" onClick={() => selectActor(worker)} className="flex w-full items-center justify-between gap-4 border-b border-[#102B4C]/7 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#F7F9FC]"><WorkerIdentity worker={worker}/><span className="text-[9px] font-semibold text-[#060273]/55">Select</span></button>)}</div></> : <div className="flex items-center justify-between gap-4 rounded-lg border border-[#060273]/12 bg-[#F5F8FC] px-4 py-3"><WorkerIdentity worker={selectedActor}/><button type="button" onClick={() => { setActorId(''); setSelectedTargetIds([]) }} className="rounded-md border border-[#102B4C]/10 bg-white px-3 py-2 text-[9px] font-semibold text-[#102B4C]/55">Change</button></div>}
      </Step>

      <Step number="02" title="Set the access" description="View reads account information and activity. Manage also allows permitted account actions.">
        <div className="grid max-w-md grid-cols-2 rounded-lg bg-[#F5F8FC] p-1">{(['view', 'manage'] as GrantLevel[]).map((item) => <button key={item} type="button" onClick={() => { setLevel(item); setSelectedTargetIds([]) }} className={`rounded-md px-4 py-2.5 text-[10px] font-semibold capitalize transition ${level === item ? 'bg-white text-[#060273] shadow-sm' : 'text-[#102B4C]/40'}`}>{level === item && <Check size={10} className="mr-1 inline"/>}{item}</button>)}</div>
      </Step>

      <Step number="03" title="Choose who becomes available" description="Lineage members already available to this worker and protected accounts are automatically excluded.">
        <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-4 transition ${allEligible ? 'border-[#060273]/18 bg-[#F5F8FC]' : 'border-[#102B4C]/10 bg-white'} ${!selectedActor ? 'pointer-events-none opacity-45' : ''}`}><input type="checkbox" checked={allEligible} disabled={!selectedActor} onChange={(event) => { setAllEligible(event.target.checked); setSelectedTargetIds([]) }} className="mt-0.5 h-4 w-4 accent-[#060273]"/><span><span className="block text-[11px] font-semibold text-[#102B4C]">All eligible workers</span><span className="mt-1 block text-[9px] leading-4 text-[#102B4C]/42">Select every currently eligible worker. Future workers are not added automatically.</span></span></label>
        {selectedActor && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[9px]"><span className="font-semibold text-emerald-700">{eligibleTargets.length} eligible</span><span className="text-[#102B4C]/38">{Math.max(0, protectedCount)} protected or already covered by lineage</span><span className="text-[#102B4C]/38">{targetIds.length} selected</span></div>}
        {!allEligible && selectedActor && <div className="mt-5"><div className="relative"><Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#102B4C]/30"/><input autoComplete="off" type="search" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Search eligible workers…" aria-label="Search eligible external workers" className={`${inputClass} pl-11`}/></div><div className="mt-3 max-h-[330px] overflow-y-auto rounded-lg border border-[#102B4C]/8 [scrollbar-width:thin]">{targetResults.length === 0 ? <p className="p-5 text-center text-[10px] text-[#102B4C]/40">No eligible workers match your search.</p> : targetResults.map((worker) => { const selected = selectedTargetIds.includes(worker.id); return <button key={worker.id} type="button" onClick={() => toggleTarget(worker.id)} className={`flex w-full items-center justify-between gap-4 border-b border-[#102B4C]/7 px-4 py-3 text-left transition last:border-b-0 ${selected ? 'bg-[#F5F8FC]' : 'hover:bg-[#FAFBFD]'}`}><WorkerIdentity worker={worker}/><span className={`flex h-4 w-4 items-center justify-center rounded border ${selected ? 'border-[#060273] bg-[#060273] text-white' : 'border-[#102B4C]/20 bg-white'}`}>{selected && <Check size={10}/>}</span></button> })}</div></div>}
      </Step>

      <Step number="04" title="Record the reason" description="This explanation is stored with the owner security audit.">
        <textarea aria-label="Reason for advanced worker access" required minLength={10} maxLength={300} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this access is needed…" className={`${inputClass} max-w-3xl resize-none`}/>
      </Step>

      <div className="flex flex-col gap-3 border-t border-[#102B4C]/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-[9px] leading-4 text-[#102B4C]/38">The backend will validate every selected account again before access is granted.</p><button disabled={loading || !selectedActor || targetIds.length === 0 || reason.trim().length < 10} className="rounded-lg bg-[#102B4C] px-5 py-3 text-[10px] font-semibold text-white transition hover:bg-[#060273] disabled:cursor-not-allowed disabled:opacity-40">Review {targetIds.length || ''} {targetIds.length === 1 ? 'worker' : 'workers'}</button></div>
    </form>

    <section className="overflow-hidden rounded-lg border border-[#102B4C]/10 bg-white">
      <div className="flex flex-col gap-4 border-b border-[#102B4C]/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><h2 className="text-[12px] font-semibold text-[#102B4C]">Active advanced access</h2><p className="mt-1 text-[9px] text-[#102B4C]/40">Grouped by the worker receiving access · {grants.length} active {grants.length === 1 ? 'grant' : 'grants'}</p></div>{grants.length > 0 && <div className="relative sm:w-64"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#102B4C]/30"/><input type="search" value={grantSearch} onChange={(event) => setGrantSearch(event.target.value)} placeholder="Search active access…" aria-label="Search active advanced access" className="w-full rounded-md border border-[#102B4C]/10 bg-[#F7F9FC] py-2.5 pl-9 pr-3 text-[10px] outline-none focus:border-[#060273]/30"/></div>}</div>
      <div className={groupedGrants.length > 6 ? 'max-h-[720px] overflow-y-auto [scrollbar-width:thin]' : ''}>{loading ? <p className="p-10 text-center text-[10px] text-[#102B4C]/40">Loading access controls…</p> : groupedGrants.length === 0 ? <div className="p-10 text-center"><ShieldCheck className="mx-auto text-[#102B4C]/18"/><p className="mt-3 text-[10px] text-[#102B4C]/42">{grants.length ? 'No active access matches your search.' : 'No advanced access has been granted.'}</p></div> : groupedGrants.map((group) => { const expanded = expandedActors.includes(group.actor.id); const visible = expanded || grantSearch.trim() ? group.grants : group.grants.slice(0, 4); return <div key={group.actor.id} className="border-b border-[#102B4C]/8 px-5 py-5 last:border-b-0 sm:px-7"><div className="flex items-center justify-between gap-4"><WorkerIdentity worker={group.actor}/><span className="rounded bg-[#F0F3F8] px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-[#102B4C]/50">{group.grants.length} {group.grants.length === 1 ? 'account' : 'accounts'}</span></div><div className="mt-4 divide-y divide-[#102B4C]/7 rounded-lg border border-[#102B4C]/8">{visible.map((grant) => <div key={grant.id} className="flex items-start justify-between gap-4 px-4 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-semibold text-[#102B4C]">{workerLabel(grant.target)}</p><span className={`rounded px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${grant.level === 'manage' ? 'bg-[#FFF1F1] text-[#B42318]' : 'bg-[#F0F3F8] text-[#102B4C]/55'}`}>{grant.level}</span></div><p className="mt-1 truncate text-[9px] text-[#102B4C]/38">{grant.reason}</p></div><button type="button" onClick={() => setRevokeGrant(grant)} aria-label={`Revoke access to ${workerLabel(grant.target)}`} className="shrink-0 rounded-md p-2 text-red-600 transition hover:bg-red-50"><Trash2 size={12}/></button></div>)}</div>{group.grants.length > 4 && !grantSearch.trim() && <button type="button" onClick={() => setExpandedActors((current) => expanded ? current.filter((id) => id !== group.actor.id) : [...current, group.actor.id])} className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#060273]/60">{expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {expanded ? 'Show less' : `Show ${group.grants.length - 4} more`}</button>}</div> })}</div>
    </section>

    {confirmingGrant && selectedActor && <ConfirmationModal title="Confirm advanced access" busy={saving} onClose={() => setConfirmingGrant(false)} onConfirm={() => void confirmGrant()} confirmLabel="Grant access"><p><strong>{workerLabel(selectedActor)}</strong> will receive <strong>{level}</strong> access to <strong>{targetIds.length} currently eligible {targetIds.length === 1 ? 'worker' : 'workers'}</strong>.</p><p className="mt-3">Protected accounts, ancestors and normal lineage relationships remain unchanged. Future workers will not be added automatically.</p><p className="mt-3"><strong>Reason:</strong> {reason.trim()}</p>{level === 'manage' && <p className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-red-700">Manage access includes permitted profile edits, status changes and password resets. Account deletion remains owner-only.</p>}</ConfirmationModal>}
    {revokeGrant && <ConfirmationModal title="Revoke this access?" busy={saving} onClose={() => setRevokeGrant(null)} onConfirm={() => void confirmRevoke()} confirmLabel="Revoke access" destructive><p><strong>{workerLabel(revokeGrant.actor)}</strong> will immediately lose exceptional access to <strong>{workerLabel(revokeGrant.target)}</strong>. Their normal lineage access will not change.</p></ConfirmationModal>}
  </div>
}

function Step({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="grid gap-5 border-b border-[#102B4C]/8 px-5 py-6 last:border-b-0 sm:px-7 lg:grid-cols-[210px_minmax(0,1fr)]"><div><span className="text-[8px] font-semibold tracking-[0.18em] text-[#E81F2D]/65">{number}</span><h2 className="mt-1 text-[11px] font-semibold text-[#102B4C]">{title}</h2><p className="mt-1 text-[9px] leading-4 text-[#102B4C]/38">{description}</p></div><div>{children}</div></section>
}

function WorkerIdentity({ worker }: { worker: AuthUser }) {
  return <div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F3F8] text-[#102B4C]/45"><UserRound size={14}/></div><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-[#102B4C]">{workerLabel(worker)}</p><p className="mt-0.5 truncate text-[9px] text-[#102B4C]/38">{worker.jobTitle || 'Worker'} · {worker.email}</p></div></div>
}

function ConfirmationModal({ title, busy, onClose, onConfirm, confirmLabel, destructive = false, children }: { title: string; busy: boolean; onClose: () => void; onConfirm: () => void; confirmLabel: string; destructive?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[240] flex items-center justify-center p-4"><div className="absolute inset-0 bg-[#102B4C]/55 backdrop-blur-sm" onClick={() => !busy && onClose()}/><section role="alertdialog" aria-modal="true" aria-labelledby="access-confirm-title" className="relative w-full max-w-md rounded-xl border border-[#102B4C]/10 bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><h2 id="access-confirm-title" className="text-[17px] font-semibold text-[#102B4C]">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close confirmation" className="rounded-md p-1.5 text-[#102B4C]/35"><X size={16}/></button></div><div className="mt-4 text-[11px] leading-5 text-[#102B4C]/55">{children}</div><div className="mt-7 flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="px-4 py-2.5 text-[10px] font-semibold text-[#102B4C]/50 disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className={`rounded-lg px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-[#102B4C] hover:bg-[#060273]'}`}>{busy ? 'Saving…' : confirmLabel}</button></div></section></div>
}
