import { GripVertical, Edit2, Trash2, UserPlus, Info } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

interface TeamMember {
  _id: string
  name: string
  role: string
  image: string
  bio?: string
  order: number
}

interface LeadershipStudioProps {
  canManage: boolean
  team: TeamMember[]
  onAdd: () => void
  onEdit: (member: TeamMember) => void
  onDelete: (id: string) => void
  onUpdateSettings: (settings: any) => void
  settings: any
}

export default function LeadershipStudio({
  canManage,
  team,
  onAdd,
  onEdit,
  onDelete,
  onUpdateSettings,
  settings
}: LeadershipStudioProps) {

  const sortedTeam = [...team].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div className="space-y-8 pb-20">

      {/* Slider Settings */}
      <div className="bg-white border border-charcoal/10 p-6 rounded-md shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 pb-4 border-b border-charcoal/5">
          <div>
            <h3 className="text-[12px] font-semibold text-charcoal uppercase tracking-wider">Slider Dynamics</h3>
            <p className="text-[11px] text-charcoal/40 font-medium mt-0.5">Configure auto-slide behavior for the Leadership section.</p>
          </div>
          {canManage && <button
            onClick={() => onUpdateSettings(settings)}
            className="px-4 py-2 bg-charcoal text-white rounded-md text-[11px] font-semibold uppercase tracking-wider hover:bg-black"
          >
            Save Settings
          </button>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide">Auto-Advance</label>
            <div className="flex bg-warm-stone/50 p-1 rounded border border-charcoal/5 w-fit">
              {['on', 'off'].map(opt => (
                <button
                  key={opt}
                  disabled={!canManage}
                  onClick={() => onUpdateSettings({...settings, autoSlide: opt === 'on'})}
                  className={`px-6 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                    (settings.autoSlide ? 'on' : 'off') === opt ? 'bg-white text-brass shadow-sm border border-charcoal/5' : 'text-charcoal/30 hover:text-charcoal'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide">Interval (Seconds)</label>
            <input
              type="number"
              value={settings.delaySeconds}
              disabled={!canManage}
              onChange={(e) => onUpdateSettings({...settings, delaySeconds: parseInt(e.target.value) || 5})}
              className="w-32 px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none"
              min="5"
            />
          </div>
        </div>
      </div>

      {/* Team Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-charcoal uppercase tracking-wider">Executive Roster</h3>
          {canManage && <button
            onClick={onAdd}
            className="px-4 py-2 border border-charcoal/10 rounded-md text-[11px] font-semibold uppercase tracking-wider hover:bg-warm-stone transition-all flex items-center gap-2"
          >
            <UserPlus size={14} /> Add Executive
          </button>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sortedTeam.map((m, idx) => (
            <div key={m._id} className="bg-white border border-charcoal/10 p-4 rounded-md shadow-sm group relative hover:border-charcoal/30 transition-all">
              {canManage && <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={() => onEdit(m)} className="p-1.5 bg-white border border-charcoal/10 rounded-md hover:text-blue-600 shadow-sm"><Edit2 size={12}/></button>
                <button onClick={() => onDelete(m._id)} className="p-1.5 bg-white border border-charcoal/10 rounded-md hover:text-red-600 shadow-sm"><Trash2 size={12}/></button>
              </div>}

              <div className="aspect-[1/1] bg-warm-stone rounded overflow-hidden mb-4 border border-charcoal/5 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">
                <img src={resolveMediaUrl(m.image)} className="w-full h-full object-cover" alt={m.name} />
              </div>

              <div className="space-y-0.5">
                <p className="text-[9px] font-bold text-brass uppercase tracking-widest">{m.role}</p>
                <h4 className="text-[15px] font-semibold text-charcoal tracking-tight leading-tight">{m.name}</h4>
                <div className="pt-2 flex items-center gap-2">
                   <span className="text-[9px] font-bold text-charcoal/20 uppercase tracking-widest">Position {idx + 1}</span>
                   {m.bio && <Info size={10} className="text-brass/40" />}
                </div>
              </div>
            </div>
          ))}

          {team.length === 0 && (
            <div className="col-span-full py-20 text-center border border-dashed border-charcoal/10 rounded-lg">
              <p className="text-charcoal/20 uppercase tracking-[0.2em] text-[10px] font-bold">Roster Empty</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-warm-stone/20 border border-charcoal/5 rounded-md flex items-center gap-3">
        <GripVertical size={16} className="text-charcoal/20" />
        <p className="text-[11px] text-charcoal/50 font-medium">Use the edit tool on each card to adjust profiles and ordering.</p>
      </div>
    </div>
  )
}
